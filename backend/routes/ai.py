from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from ai.adapters import ADAPTERS, MODELS, get_adapter
from ai.grounding import PALETTE
from models.ai_provider import AIProvider
from models.models import Model
from models.user import User
from schema.ai import AIProviderCreate, AIProviderResponse, AIProviderUpdate
from security import check_permissions, decrypt_password, encrypt_password, get_current_user
from utils.cube import extract_cube_names
from utils.init_database import get_db

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

MANAGE = ["*", "ai:*", "ai:manage"]


def _require(user: User, *permissions):
    if not check_permissions(user, *permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Unauthorized : Insufficient permissions")


def _hint(api_key: str) -> str:
    """What the frontend sees instead of the key. Never widen this."""
    return f"{api_key[:3]}...{api_key[-4:]}" if len(api_key) > 12 else "..." + api_key[-2:]


def _provider_or_404(db: Session, user: User, provider_id: UUID) -> AIProvider:
    row = (
        db.query(AIProvider)
        .filter(and_(AIProvider.public_key == provider_id,
                     AIProvider.account_id == user.account_id,
                     AIProvider.is_active == True))
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI provider not found")
    if row.provider not in ADAPTERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Provider '{row.provider}' has no adapter")
    return row


def provider_model(row: AIProvider) -> str:
    """The model this provider prompts with. Chosen once when the provider was
    added; falls back to the first of its listed models for rows created before
    default_model existed."""
    model = row.default_model or (row.models or [None])[0]
    if not model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider '{row.label}' has no model selected — pick one in AI Providers.",
        )
    return model


def resolve_provider(db: Session, user: User, provider_id: UUID | None) -> tuple[AIProvider, str]:
    """(provider, model). With one active provider the caller need not name it,
    which is what keeps a model picker off every prompt surface."""
    if provider_id is not None:
        row = _provider_or_404(db, user, provider_id)
        return row, provider_model(row)

    active = (
        db.query(AIProvider)
        .filter(and_(AIProvider.account_id == user.account_id, AIProvider.is_active == True))
        .all()
    )
    if not active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="No AI provider configured — add one in AI Providers.")
    if len(active) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="More than one AI provider is active — say which one to use.",
        )
    return active[0], provider_model(active[0])


async def _model_scope(db: Session, user: User, semantic_model_id: UUID | None):
    """(Model row, set of cube names it owns) — the agent's whole world.

    Cube compiles every definition in an account into one namespace, so /meta
    can't tell us which cubes belong to which model; the definition .yml files
    can (same trick routes/definitions.py::get_compiled_definition uses)."""
    if semantic_model_id is None:
        return None, None
    model = (
        db.query(Model)
        .filter(and_(Model.public_key == semantic_model_id, Model.account_id == user.account_id))
        .first()
    )
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found")

    cube_names: set[str] = set()
    for definition in model.definitions:
        content = await storage.get_file(definition.file_path, definition.file_name)
        if content:
            cube_names |= extract_cube_names(content.getvalue().decode("utf-8"))
    return model, (cube_names or None)


# ── Providers ──────────────────────────────────────────────────────────────

@router.post("/providers", status_code=status.HTTP_201_CREATED, response_model=AIProviderResponse)
async def create_provider(
    payload: AIProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *MANAGE)
    clash = (
        db.query(AIProvider)
        .filter(and_(AIProvider.account_id == current_user.account_id, AIProvider.label == payload.label))
        .first()
    )
    if clash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="A provider with this label already exists")

    row = AIProvider(
        account_id=current_user.account_id,
        provider=payload.provider,
        label=payload.label,
        api_key_enc=encrypt_password(payload.api_key),
        api_key_hint=_hint(payload.api_key),
        base_url=payload.base_url,
        default_model=payload.default_model,
        models=payload.models or MODELS.get(payload.provider, []),
        created_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/providers", response_model=List[AIProviderResponse])
async def list_providers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *MANAGE)
    return db.query(AIProvider).filter(AIProvider.account_id == current_user.account_id).all()


@router.put("/providers/{provider_id}", response_model=AIProviderResponse)
async def update_provider(
    provider_id: UUID,
    payload: AIProviderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *MANAGE)
    row = (
        db.query(AIProvider)
        .filter(and_(AIProvider.public_key == provider_id, AIProvider.account_id == current_user.account_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI provider not found")

    data = payload.model_dump(exclude_unset=True)
    if "api_key" in data and data["api_key"]:
        row.api_key_enc = encrypt_password(data["api_key"])
        row.api_key_hint = _hint(data["api_key"])
    for key in ("label", "base_url", "models", "is_active", "default_model"):
        if key in data and data[key] is not None:
            setattr(row, key, data[key])
    db.commit()
    db.refresh(row)
    return row


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require(current_user, *MANAGE)
    row = (
        db.query(AIProvider)
        .filter(and_(AIProvider.public_key == provider_id, AIProvider.account_id == current_user.account_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI provider not found")
    db.delete(row)
    db.commit()


@router.post("/providers/{provider_id}/test", status_code=status.HTTP_200_OK)
async def test_provider(
    provider_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One cheap round-trip so a bad key fails here, not halfway through
    generating an artifact."""
    _require(current_user, *MANAGE)
    row, model = resolve_provider(db, current_user, provider_id)
    adapter = get_adapter(row.provider, decrypt_password(row.api_key_enc), row.base_url)
    try:
        adapter.generate('Reply with {"ok": true} and nothing else.', "ping", model)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"message": f"Provider reachable using {model}"}


@router.post("/providers/{provider_id}/refresh-models", response_model=AIProviderResponse)
async def refresh_provider_models(
    provider_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-read the model list from the provider itself and store it. Providers
    retire ids (Google retired gemini-2.5-pro), so a stored list goes stale and
    the picker offers models that 404."""
    _require(current_user, *MANAGE)
    row = _provider_or_404(db, current_user, provider_id)
    adapter = get_adapter(row.provider, decrypt_password(row.api_key_enc), row.base_url)
    try:
        models = adapter.available_models()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Could not read the provider's model list: {exc}")
    if not models:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="The provider returned no usable chat models.")
    row.models = models
    if row.default_model not in models:
        row.default_model = None   # the chosen model no longer exists — force a re-pick
    db.commit()
    db.refresh(row)
    return row


@router.get("/models")
async def list_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Feeds the builder's model picker. Any signed-in user may pick a model;
    only ai:manage may see or change the provider keys."""
    rows = (
        db.query(AIProvider)
        .filter(and_(AIProvider.account_id == current_user.account_id, AIProvider.is_active == True))
        .all()
    )
    return [
        {"provider_id": str(r.public_key), "provider": r.provider, "label": r.label,
         "model": r.default_model or (r.models or [None])[0]}
        for r in rows
    ]


@router.get("/known-models")
async def known_models(current_user: User = Depends(get_current_user)):
    """Curated ids per provider, for the Add-provider dialog's model picker —
    there is no key to query yet at that point. After saving, Sync models
    replaces this with the provider's live list."""
    return MODELS


@router.get("/themes")
async def list_themes(current_user: User = Depends(get_current_user)):
    return [{"name": name, "colors": colors} for name, colors in PALETTE.items()]
