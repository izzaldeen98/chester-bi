"""Builds the three grounding blocks every agent call is given:

  1. the live Cube semantic model (from /meta, cached per definition version)
  2. the account's saved datasets — the ONLY things a chart may reference
  3. the generated component/filter spec (backend/grounding/visual_component_spec.md)

The component spec is generated from the frontend's ChartsSchemas.ts by
grounding/gen_component_spec.py, so it cannot drift from what the renderer
accepts. The Cube block is never cached across definition edits: its key
includes utils.cube._definition_version(), which already changes whenever an
account's .yml definitions change.
"""
import json
from hashlib import sha256
from pathlib import Path

from sqlalchemy.orm import Session

from models.datasets import Dataset
from models.definitions import Definition
from models.models import Model
from utils.cube import _definition_version, meta_raw, mint_token
from utils.redis_handler import cache_query, get_cached_query

SPEC_PATH = Path(__file__).resolve().parent.parent / "grounding" / "visual_component_spec.md"

# ponytail: one palette constant instead of a theme system — lib/theme.jsx is a
# binary light/dark class toggle with no named themes or design tokens, so
# "pick a theme" means "fill the color fields ChartsSchemas already exposes".
# Swap for real theme tokens when the app grows them.
PALETTE = {
    "chester": ["#eab308", "#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#ef4444"],
    "ocean": ["#0ea5e9", "#14b8a6", "#6366f1", "#06b6d4", "#3b82f6", "#8b5cf6"],
    "ember": ["#f97316", "#ef4444", "#eab308", "#dc2626", "#fb923c", "#a16207"],
    "mono": ["#111827", "#4b5563", "#9ca3af", "#6b7280", "#374151", "#d1d5db"],
}
DEFAULT_TEXT_COLOR = "#111827"


def component_spec() -> str:
    if not SPEC_PATH.exists():
        raise Exception(
            f"{SPEC_PATH} is missing — run `python backend/grounding/gen_component_spec.py`"
        )
    return SPEC_PATH.read_text()


def cube_grounding(db: Session, account_public_key, account_id: int,
                   allowed_cubes: set | None = None) -> tuple[str, dict]:
    """(prose rendering of Cube's /meta for the LLM, members dict for the
    validator: {"all", "measures", "dimensions", "segments", "time_dimensions"},
    each a set of qualified "Cube.field" names). Includes the titles and descriptions that
    utils.cube.normalize_meta() strips out for the query-builder UI.

    Cube compiles every definition in an account into one shared namespace, so
    /meta always returns every cube the account has. `allowed_cubes` narrows it
    to the cubes owned by the semantic model the user picked — the agent should
    only ever see the model it was pointed at."""
    scope = ",".join(sorted(allowed_cubes)) if allowed_cubes else "all"
    key = (f"ai_cube_context:{account_public_key}:{_definition_version(account_public_key)}"
           f":{sha256(scope.encode()).hexdigest()[:12]}")
    try:
        cached = get_cached_query(key)
        if cached:
            return cached["text"], {k: set(v) for k, v in cached["members"].items()}
    except Exception:
        pass  # no Redis in this environment — regenerate every time

    raw = meta_raw(mint_token(db, account_public_key, account_id))
    lines = []
    members = {"all": set(), "measures": set(), "dimensions": set(),
               "segments": set(), "time_dimensions": set()}
    for cube in raw.get("cubes", []):
        if allowed_cubes is not None and cube["name"] not in allowed_cubes:
            continue
        header = cube.get("title") or cube["name"]
        lines.append(f"### cube {cube['name']} ({header})")
        if cube.get("description"):
            lines.append(cube["description"])
        for kind in ("measures", "dimensions", "segments"):
            entries = cube.get(kind) or []
            if not entries:
                continue
            lines.append(f"{kind}:")
            for m in entries:
                # Cube reports members pre-qualified as "Cube.field".
                members["all"].add(m["name"])
                members[kind].add(m["name"])
                if kind == "dimensions" and m.get("type") == "time":
                    members["time_dimensions"].add(m["name"])
                bits = [f"  - {m['name']}"]
                if m.get("type"):
                    bits.append(f"({m['type']})")
                if m.get("title") and m["title"] != m["name"]:
                    bits.append(f"— {m['title']}")
                if m.get("description"):
                    bits.append(f": {m['description']}")
                lines.append(" ".join(bits))
        lines.append("")
    text = "\n".join(lines) or "(no cubes defined for this account)"

    try:
        cache_query(key, {"text": text, "members": {k: sorted(v) for k, v in members.items()}})
    except Exception:
        pass
    return text, members


def account_datasets(db: Session, account_id: int, semantic_model_id=None) -> list[Dataset]:
    """Datasets the agent may reference. Scoped to one semantic model when the
    user picked one on the builder page."""
    query = (
        db.query(Dataset)
        .join(Definition, Dataset.definition_id == Definition.id)
        .join(Model, Definition.model_id == Model.id)
        .filter(Model.account_id == account_id)
    )
    if semantic_model_id is not None:
        query = query.filter(Model.public_key == semantic_model_id)
    return query.all()


def dataset_block(datasets: list[Dataset]) -> str:
    """Charts bind to a saved Dataset (meta.datasetId), never to an inline Cube
    query — see frontend/src/lib/dashboardWidgetData.ts. So this list is the
    agent's entire vocabulary of available data."""
    if not datasets:
        return "(this account has no saved datasets — no chart can be built)"
    out = []
    for d in datasets:
        out.append(
            json.dumps(
                {
                    "datasetId": str(d.public_key),
                    "name": d.name,
                    "description": d.description,
                    "source": d.source,
                    "measures": d.aggregation_fields or [],
                    "dimensions": d.group_by_fields or [],
                    "definitionId": str(d.definition.public_key),
                    "definitionName": d.definition.name,
                    "modelId": str(d.definition.model.public_key),
                    "modelName": d.definition.model.name,
                },
                default=str,
            )
        )
    return "\n".join(out)


def dataset_fields(dataset: Dataset) -> set[str]:
    return set(dataset.aggregation_fields or []) | set(dataset.group_by_fields or [])
