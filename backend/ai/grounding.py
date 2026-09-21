"""Builds the grounding the artifact agent is given: the live Cube semantic
model, rendered for an LLM, plus the theme palettes.

The Cube block is never cached across definition edits — its key includes
utils.cube._definition_version(), which already changes whenever an account's
.yml definitions change.
"""
from hashlib import sha256

from sqlalchemy.orm import Session

from utils.cube import _definition_version, meta_raw, mint_token
from utils.redis_handler import cache_query, get_cached_query

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
