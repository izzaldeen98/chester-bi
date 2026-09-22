from datetime import datetime, timezone
from io import BytesIO
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy import and_
from sqlalchemy.orm import Session

from ai import artifact as artifact_agent
from ai.grounding import cube_grounding
from ai.validate import validate_runtime_filters
from models.artifact import Artifact
from models.ai_provider import AIProvider
from models.user import User
from routes.ai import _model_scope, _require, resolve_provider
from schema.artifacts import (
    ArtifactCreateRequest,
    ArtifactQueryRequest,
    ArtifactRefineRequest,
    ArtifactResponse,
)
from security import get_current_user
from utils.config_files import storage
from utils.init_database import get_db

router = APIRouter(prefix="/api/v1/artifacts", tags=["artifacts"])

CREATE = ["*", "artifacts:*", "artifacts:create"]
READ = ["*", "artifacts:*", "artifacts:list"]
EDIT = ["*", "artifacts:*", "artifacts:edit"]
DELETE = ["*", "artifacts:*", "artifacts:delete"]


def _provider_for(db: Session, user: User, row: Artifact, asked: UUID | None):
    """Which provider refines this artifact. An explicit choice wins; otherwise
    prefer the provider that created it, so refining a Gemini artifact does not
    silently jump to whichever provider happens to be listed first."""
    if asked is None and row.provider:
        own = (
            db.query(AIProvider)
            .filter(and_(AIProvider.account_id == user.account_id,
                         AIProvider.provider == row.provider,
                         AIProvider.is_active == True))
            .first()
        )
        if own:
            asked = own.public_key
    return resolve_provider(db, user, asked)


def _folder(user: User) -> str:
    return f"cube_data/{str(user.account.public_key)}/artifacts"


def _artifact_or_404(db: Session, user: User, artifact_id: UUID) -> Artifact:
    row = (
        db.query(Artifact)
        .filter(and_(Artifact.public_key == artifact_id, Artifact.account_id == user.account_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    return row


async def _artifact_scope(db: Session, user: User, row: Artifact):
    """(model, cube names) for the ONE semantic model this artifact belongs to.

    Cube compiles every definition in an account into a single namespace, so
    scoping is not automatic: without it, an artifact built on one model can
    reference another model's cubes and Cube will happily answer. Every path
    that validates or plans against /meta must go through here."""
    if row.semantic_model is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This artifact is not bound to a semantic model. Recreate it.",
        )
    model, cube_names = await _model_scope(db, user, row.semantic_model.public_key)
    if not cube_names:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'The semantic model "{model.name}" defines no cubes.',
        )
    return model, cube_names


def _spec_for_version(row: Artifact, version: int | None) -> dict:
    """The spec as it was at that version. Specs are small, so every version
    carries a full copy rather than a diff."""
    if version:
        for prompt in row.prompts or []:
            if prompt.get("version") == version and prompt.get("spec"):
                return prompt["spec"]
    return row.spec or {}


def _queries_for_version(row: Artifact, version: int | None) -> list:
    """The query set as it was when that version's markup was written. Refining
    can add or change queries, so an old page must not be run against the new
    ones — its JS reads columns that set no longer returns."""
    if version:
        for prompt in row.prompts or []:
            if prompt.get("version") == version and prompt.get("queries"):
                return prompt["queries"]
    return row.queries or []


def _manifest(row: Artifact, version: int | None = None) -> dict:
    """What the page is allowed to ask for. Columns are advisory — the page
    reads them to lay out, but the authoritative shape arrives with the rows."""
    return {
        q["id"]: {"name": q.get("label") or q["id"], "columns": q.get("columns") or []}
        for q in _queries_for_version(row, version)
    }


async def _read_markup(row: Artifact, version: int | None = None) -> str:
    """The current markup, or one version's snapshot. Artifacts created before
    snapshots existed have only the current file, so a missing snapshot falls
    back to it rather than 404-ing."""
    names = [f"{row.public_key}.html"]
    if version:
        names.insert(0, f"{row.public_key}.v{version}.html")
    for name in names:
        content = await storage.get_file(row.file_path, name)
        if content:
            return content.getvalue().decode("utf-8")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact file not found")


async def _write_markup(row: Artifact, markup: str, version: int) -> None:
    """Writes the current file plus an immutable snapshot for this version, so
    every prompt stays viewable."""
    payload = markup.encode("utf-8")
    await storage.upload_file(BytesIO(payload), row.file_path, f"{row.public_key}.html")
    await storage.upload_file(BytesIO(payload), row.file_path, f"{row.public_key}.v{version}.html")


@router.post("/create", response_model=ArtifactResponse, status_code=status.HTTP_201_CREATED)
async def create_artifact(
    payload: ArtifactCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *CREATE)
    provider_row, llm_model = resolve_provider(db, current_user, payload.provider_id)
    semantic_model, cube_names = await _model_scope(db, current_user, payload.semantic_model_id)

    try:
        result = artifact_agent.generate(
            db, current_user, provider_row, llm_model, payload.brief, payload.theme,
            semantic_model, cube_names,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    row = Artifact(
        account_id=current_user.account_id,
        name=(payload.name or result["title"])[:127],
        description=result["description"][:255],
        theme=payload.theme,
        provider=provider_row.provider,
        llm_model=llm_model,
        semantic_model_id=semantic_model.id if semantic_model is not None else None,
        queries=result["queries"],
        spec=result["spec"],
        file_path=_folder(current_user),
        prompts=[{"version": 1, "instruction": payload.brief, "model": llm_model,
                  "queries": result["queries"], "spec": result["spec"],
                  "usage": result.get("usage"),
                  "at": datetime.now(timezone.utc).isoformat()}],
        current_version=1,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)


    # Transient, response-only: the page saved fine, but the user should know
    # what the agent could not answer before they go looking for it.
    labels = {q["id"]: q.get("label") or q["id"] for q in result["queries"]}
    row.warnings = [f"Not covered by this semantic model: {u}" for u in result.get("unmet", [])] + [
        f'"{labels.get(qid, qid)}" returned no rows — that chart will be empty.'
        for qid in result.get("empty", [])
    ]
    return row


@router.get("/list", response_model=List[ArtifactResponse])
async def list_artifacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *READ)
    return (
        db.query(Artifact)
        .filter(Artifact.account_id == current_user.account_id)
        .order_by(Artifact.updated_at.desc())
        .all()
    )


@router.get("/get/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    artifact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *READ)
    return _artifact_or_404(db, current_user, artifact_id)


@router.get("/render/{artifact_id}", response_class=HTMLResponse)
async def render_artifact(
    artifact_id: UUID,
    version: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The full page with data re-queried from Cube on every call — the saved
    file holds markup only. The caller drops this into a sandboxed iframe."""
    _require(current_user, *READ)
    row = _artifact_or_404(db, current_user, artifact_id)
    spec = _spec_for_version(row, version)
    if not spec:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This artifact predates the component runtime. Recreate it to use "
                   "live components.",
        )
    # Assembled fresh from pre-built components, with no Cube call here: each
    # component queries for itself, so new data appears without regeneration.
    return HTMLResponse(artifact_agent.render_page(spec, row.theme, row.name))


@router.post("/query/{artifact_id}")
async def query_artifact(
    artifact_id: UUID,
    payload: ArtifactQueryRequest,
    version: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run ONE of an artifact's stored queries, with the dashboard's currently
    applied filters merged in.

    This is the whole live-data story: the saved page holds no rows, so every
    chart calls here on open and again whenever a filter changes. Only the
    components whose effective query actually changed will miss the cache."""
    _require(current_user, *READ)
    row = _artifact_or_404(db, current_user, artifact_id)

    queries = _queries_for_version(row, version)
    entry = next((q for q in queries if q["id"] == payload.query_id), None)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"This artifact has no query '{payload.query_id}'")

    # The page is untrusted: check its filters against the live model before
    # they reach Cube, so a bad operator is a clear error rather than a chart
    # that silently stops refreshing.
    if payload.filters:
        _, cube_names = await _artifact_scope(db, current_user, row)
        _, members = cube_grounding(
            db, current_user.account.public_key, current_user.account_id, cube_names
        )
        problems = validate_runtime_filters(payload.filters, members)
        if problems:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="; ".join(problems[:4]))

    try:
        rows, cached = artifact_agent.run_query(
            db, current_user, entry["cube_query"], payload.filters
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return {"id": entry["id"], "rows": rows, "cached": cached, "count": len(rows)}


@router.post("/refine/{artifact_id}", response_model=ArtifactResponse)
async def refine_artifact(
    artifact_id: UUID,
    payload: ArtifactRefineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ask for a change to the whole page. The previous markup is kept until the
    model returns a non-empty replacement, so a failed refine changes nothing."""
    _require(current_user, *EDIT)
    row = _artifact_or_404(db, current_user, artifact_id)
    provider_row, llm_model = _provider_for(db, current_user, row, payload.provider_id)
    semantic_model, cube_names = await _artifact_scope(db, current_user, row)

    try:
        result = artifact_agent.refine(
            db, current_user, provider_row, llm_model, row.spec or {},
            row.queries or [], payload.instruction, semantic_model, cube_names,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    version = (row.current_version or len(row.prompts or []) or 1) + 1
    # The edit may have rewritten a component's query; drop the stale entries
    # so the next open does not serve rows for a query that no longer exists.
    for q in (row.queries or []) + result["queries"]:
        artifact_agent.invalidate_query(current_user.account.public_key, q.get("cube_query") or {})
    row.queries = result["queries"]
    row.spec = result["spec"]
    row.prompts = (row.prompts or []) + [
        {"version": version, "instruction": payload.instruction, "model": llm_model,
         "queries": result["queries"], "spec": result["spec"],
         "usage": result.get("usage"),
         "at": datetime.now(timezone.utc).isoformat()}
    ]
    row.current_version = version
    row.llm_model = llm_model
    row.provider = provider_row.provider
    row.updated_by = current_user.id
    db.commit()
    db.refresh(row)
    return row


@router.post("/restore/{artifact_id}", response_model=ArtifactResponse)
async def restore_artifact_version(
    artifact_id: UUID,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Make an earlier version current again. The snapshots are immutable, so
    this only rewrites the current file — no version is ever lost."""
    _require(current_user, *EDIT)
    row = _artifact_or_404(db, current_user, artifact_id)
    known = {p.get("version") for p in (row.prompts or [])}
    if version not in known:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such version")

    restored_spec = _spec_for_version(row, version)
    if not restored_spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Version {version} has no stored spec")
    row.spec = restored_spec
    restored = _queries_for_version(row, version)
    if restored:
        row.queries = restored   # a version's spec and its queries move together
    row.current_version = version
    row.updated_by = current_user.id
    db.commit()
    db.refresh(row)
    return row


@router.delete("/delete/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    artifact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *DELETE)
    row = _artifact_or_404(db, current_user, artifact_id)
    await storage.delete_file(row.file_path, f"{row.public_key}.html")
    for prompt in row.prompts or []:
        if prompt.get("version"):
            await storage.delete_file(row.file_path, f"{row.public_key}.v{prompt['version']}.html")
    db.delete(row)
    db.commit()
