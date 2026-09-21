"""Validates LLM-authored dashboard elements against the same schema the React
renderer reads (grounding/visual_component_spec.json, generated from
ChartsSchemas.ts) plus the account's real datasets and live Cube meta.

Nothing invalid is ever saved: errors go back to the model for a bounded number
of retries (see agent.py), and whatever still fails is dropped and reported.
"""
import json
import re
from pathlib import Path

SPEC_JSON = Path(__file__).resolve().parent.parent / "grounding" / "visual_component_spec.json"

GRID_COLS = 32  # must match GRID_COLS in frontend/src/pages/DashboardWorkSpace.tsx
HEX_RE = re.compile(r"^#[0-9a-fA-F]{3,8}$")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def _spec() -> dict:
    if not SPEC_JSON.exists():
        raise Exception(f"{SPEC_JSON} is missing — run `python backend/grounding/gen_component_spec.py`")
    return json.loads(SPEC_JSON.read_text())


SPEC = _spec()
CHARTS = {c["type"]: c for c in SPEC["charts"]}
FILTER_OPS = {f["kind"]: set(f["operators"]) for f in SPEC["filters"]}


def _split(value: str) -> list[str]:
    """chartConfig list values are comma-joined strings — same parse as
    frontend/src/components/charts/LineChart.tsx::parseList."""
    return [p.strip() for p in str(value).split(",") if p.strip()]


def validate_layout(layout: dict, grid_rows: int, where: str) -> list[str]:
    errs = []
    if not isinstance(layout, dict):
        return [f"{where}: layout must be an object"]
    for k in ("x", "y", "w", "h"):
        if not isinstance(layout.get(k), int):
            errs.append(f"{where}: layout.{k} must be an integer")
    if errs:
        return errs
    if layout["w"] < 1 or layout["h"] < 1:
        errs.append(f"{where}: layout.w and layout.h must be at least 1")
    if layout["x"] < 0 or layout["x"] + layout["w"] > GRID_COLS:
        errs.append(f"{where}: layout.x + layout.w must be <= {GRID_COLS} (got {layout['x']}+{layout['w']})")
    if layout["y"] < 0 or layout["y"] + layout["h"] > grid_rows:
        errs.append(f"{where}: layout.y + layout.h must be <= gridRows ({grid_rows})")
    return errs


def validate_widget(el: dict, datasets_by_id: dict, grid_rows: int) -> list[str]:
    where = f"widget {el.get('id')}"
    meta = el.get("meta") or {}
    errs = validate_layout(el.get("layout"), grid_rows, where)

    dataset_id = str(meta.get("datasetId") or "")
    dataset = datasets_by_id.get(dataset_id)
    if not dataset:
        return errs + [f"{where}: datasetId '{dataset_id}' is not one of the available datasets"]

    chart_type = meta.get("chartType")
    if chart_type not in CHARTS:
        return errs + [f"{where}: chartType '{chart_type}' is unknown (allowed: {', '.join(CHARTS)})"]

    config = meta.get("chartConfig")
    if not isinstance(config, dict):
        return errs + [f"{where}: meta.chartConfig must be an object"]

    fields = {f["name"]: f for f in CHARTS[chart_type]["fields"]}
    available = set(dataset.get("fields", ()))

    for key in config:
        if key not in fields:
            errs.append(f"{where}: chartConfig key '{key}' is not valid for chartType '{chart_type}'")
    for name, f in fields.items():
        if f["required"] and not str(config.get(name, "")).strip():
            errs.append(f"{where}: chartConfig.{name} is required for chartType '{chart_type}'")

    for key, value in config.items():
        f = fields.get(key)
        if f is None or value is None or str(value).strip() == "":
            continue
        if not isinstance(value, str):
            errs.append(f"{where}: chartConfig.{key} must be a string (got {type(value).__name__})")
            continue
        kind = f["kind"]
        if kind == "field" and value not in available:
            errs.append(f"{where}: chartConfig.{key}='{value}' is not a field of dataset '{dataset['name']}'")
        elif kind == "fields":
            for part in _split(value):
                if part not in available:
                    errs.append(f"{where}: chartConfig.{key} references '{part}', not a field of dataset '{dataset['name']}'")
        elif kind == "enum" and value not in f["enum"]:
            errs.append(f"{where}: chartConfig.{key}='{value}' must be one of {f['enum']}")
        elif kind == "bool" and value not in ("true", "false"):
            errs.append(f'{where}: chartConfig.{key} must be the string "true" or "false"')
        elif kind == "number" and not str(value).lstrip("-").replace(".", "", 1).isdigit():
            errs.append(f"{where}: chartConfig.{key}='{value}' must be a number written as a string")
        elif kind == "color" and not HEX_RE.match(value):
            errs.append(f"{where}: chartConfig.{key}='{value}' must be a hex color")
        elif kind == "colors":
            for part in _split(value):
                if not HEX_RE.match(part):
                    errs.append(f"{where}: chartConfig.{key} contains '{part}', not a hex color")
    return errs


def validate_filter(el: dict, meta_fields: set, definition_ids: set, grid_rows: int) -> list[str]:
    where = f"filter {el.get('id')}"
    errs = validate_layout(el.get("layout"), grid_rows, where)
    rule = (el.get("meta") or {}).get("filterRule")
    if not isinstance(rule, dict):
        return errs + [f"{where}: meta.filterRule must be an object"]

    kind = rule.get("kind")
    if kind not in FILTER_OPS:
        return errs + [f"{where}: filterRule.kind '{kind}' is unknown (allowed: {', '.join(FILTER_OPS)})"]
    if rule.get("operator") not in FILTER_OPS[kind]:
        errs.append(f"{where}: operator '{rule.get('operator')}' is not valid for kind '{kind}' "
                    f"(allowed: {sorted(FILTER_OPS[kind])})")

    mappings = rule.get("mappings")
    if not isinstance(mappings, list) or not mappings:
        errs.append(f"{where}: filterRule.mappings must list at least one field mapping")
    else:
        for m in mappings:
            if str(m.get("definitionId")) not in definition_ids:
                errs.append(f"{where}: mapping definitionId '{m.get('definitionId')}' is not an available definition")
            qualified = f"{m.get('sourceName')}.{m.get('fieldName')}"
            if qualified not in meta_fields:
                errs.append(f"{where}: mapping '{qualified}' does not exist in the semantic model")
    if not isinstance(rule.get("targetWidgetIds"), list):
        errs.append(f"{where}: filterRule.targetWidgetIds must be an array ([] = applies to all widgets)")
    return errs


def validate_element(el: dict, ctx: dict) -> list[str]:
    """ctx: {datasets_by_id, meta_fields, definition_ids, grid_rows}"""
    el_id = el.get("id")
    if not isinstance(el_id, str) or not UUID_RE.match(el_id.split("-", 1)[-1]):
        return [f"element id '{el_id}' must be 'widget-<uuid4>' or 'filter-<uuid4>'"]
    if el_id.startswith("filter-"):
        return validate_filter(el, ctx["meta_fields"], ctx["definition_ids"], ctx["grid_rows"])
    if el_id.startswith("widget-"):
        return validate_widget(el, ctx["datasets_by_id"], ctx["grid_rows"])
    return [f"element id '{el_id}' must start with 'widget-' or 'filter-'"]


def validate_elements(elements: list, ctx: dict) -> tuple[list, list[str]]:
    """Returns (valid elements, error strings for the invalid ones)."""
    good, errors = [], []
    for el in elements:
        if not isinstance(el, dict):
            errors.append("elements[] must contain objects")
            continue
        el_errs = validate_element(el, ctx)
        if el_errs:
            errors.extend(el_errs)
        else:
            good.append(el)
    return good, errors


# ── Cube query validation ──────────────────────────────────────────────────
# Artifacts are not bound to saved datasets: the agent writes its own Cube
# queries against the semantic model, so every one is checked against the live
# /meta before it is allowed near Cube.

CUBE_OPERATORS = {
    "equals", "notEquals", "contains", "notContains", "startsWith", "notStartsWith",
    "endsWith", "notEndsWith", "gt", "gte", "lt", "lte", "set", "notSet",
    "inDateRange", "notInDateRange", "beforeDate", "beforeOrOnDate",
    "afterDate", "afterOrOnDate", "measureFilter",
}
# Operators that take no `values` — everything else requires at least one.
VALUELESS_OPERATORS = {"set", "notSet"}
GRANULARITIES = {"second", "minute", "hour", "day", "week", "month", "quarter", "year"}
# The whole result is embedded in the page, so an unbounded query becomes a
# multi-megabyte HTML document. Queries are capped, not trusted.
MAX_LIMIT = 5000
QUERY_ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,48}$")


def _validate_filter(f: dict, members: dict, where: str, depth: int = 0) -> list[str]:
    if not isinstance(f, dict):
        return [f"{where}: each filter must be an object"]
    # Cube allows boolean grouping: {"or": [...]} / {"and": [...]}.
    for key in ("and", "or"):
        if key in f:
            if depth >= 3:
                return [f"{where}: filters are nested too deeply"]
            if not isinstance(f[key], list) or not f[key]:
                return [f"{where}: '{key}' must be a non-empty array of filters"]
            errs = []
            for sub in f[key]:
                errs += _validate_filter(sub, members, where, depth + 1)
            return errs

    member = f.get("member") or f.get("dimension")
    if member not in members["all"]:
        return [f"{where}: filter member '{member}' does not exist in the semantic model"]
    operator = f.get("operator")
    if operator not in CUBE_OPERATORS:
        return [f"{where}: filter operator '{operator}' is not a Cube operator "
                f"(allowed: {', '.join(sorted(CUBE_OPERATORS))})"]
    values = f.get("values")
    if operator not in VALUELESS_OPERATORS:
        if not isinstance(values, list) or not values:
            return [f"{where}: filter on '{member}' with operator '{operator}' needs a non-empty "
                    f"'values' array"]
        if not all(isinstance(v, str) for v in values):
            return [f"{where}: filter values on '{member}' must be strings"]
    return []


def validate_cube_query(query: dict, members: dict, where: str) -> list[str]:
    """Checks one Cube query object against the live /meta for the semantic model
    the user picked. Returns human-readable errors for the retry turn."""
    if not isinstance(query, dict):
        return [f"{where}: cube_query must be an object"]
    errs = []

    measures = query.get("measures") or []
    dimensions = query.get("dimensions") or []
    if not isinstance(measures, list) or not isinstance(dimensions, list):
        return [f"{where}: measures and dimensions must be arrays"]
    if not measures and not dimensions:
        return [f"{where}: a query needs at least one measure or dimension"]

    for m in measures:
        if m not in members["measures"]:
            kind = "a dimension, not a measure" if m in members["dimensions"] else "unknown"
            errs.append(f"{where}: measure '{m}' is {kind}")
    for d in dimensions:
        if d not in members["dimensions"]:
            kind = "a measure, not a dimension" if d in members["measures"] else "unknown"
            errs.append(f"{where}: dimension '{d}' is {kind}")

    for td in query.get("timeDimensions") or []:
        if not isinstance(td, dict):
            errs.append(f"{where}: each timeDimensions entry must be an object")
            continue
        name = td.get("dimension")
        if name not in members["time_dimensions"]:
            errs.append(f"{where}: timeDimension '{name}' is not a time dimension of this model")
        granularity = td.get("granularity")
        if granularity is not None and granularity not in GRANULARITIES:
            errs.append(f"{where}: granularity '{granularity}' must be one of "
                        f"{', '.join(sorted(GRANULARITIES))}")
        date_range = td.get("dateRange")
        if date_range is not None and not isinstance(date_range, (str, list)):
            errs.append(f"{where}: dateRange must be a string like \"last 30 days\" or a "
                        f"[from, to] array")

    for f in query.get("filters") or []:
        errs += _validate_filter(f, members, where)

    for segment in query.get("segments") or []:
        if segment not in members["segments"]:
            errs.append(f"{where}: segment '{segment}' does not exist in the semantic model")

    order = query.get("order")
    selected = set(measures) | set(dimensions) | {
        td.get("dimension") for td in (query.get("timeDimensions") or []) if isinstance(td, dict)
    }
    if isinstance(order, dict):
        pairs = order.items()
    elif isinstance(order, list):
        pairs = [(o[0], o[1]) for o in order if isinstance(o, (list, tuple)) and len(o) == 2]
    elif order is None:
        pairs = []
    else:
        errs.append(f"{where}: order must be an object or an array of [member, direction] pairs")
        pairs = []
    for member, direction in pairs:
        if member not in selected:
            errs.append(f"{where}: order references '{member}', which the query does not select")
        if direction not in ("asc", "desc"):
            errs.append(f"{where}: order direction for '{member}' must be 'asc' or 'desc'")

    limit = query.get("limit")
    if limit is not None and (not isinstance(limit, int) or limit < 1 or limit > MAX_LIMIT):
        errs.append(f"{where}: limit must be an integer between 1 and {MAX_LIMIT}")

    unknown = set(query) - {
        "measures", "dimensions", "timeDimensions", "filters", "segments", "order", "limit",
        "offset", "timezone", "ungrouped",
    }
    for key in sorted(unknown):
        errs.append(f"{where}: '{key}' is not a Cube query key")
    return errs


def validate_queries(queries, members: dict) -> tuple[list, list[str]]:
    """Validates the agent's whole query set. Returns (valid queries, errors).
    A query the page cannot read is worse than no query, so anything invalid is
    dropped rather than half-saved."""
    if not isinstance(queries, list) or not queries:
        return [], ["The model returned no queries."]
    good, errors, seen = [], [], set()
    for entry in queries:
        if not isinstance(entry, dict):
            errors.append("each query must be an object")
            continue
        qid = entry.get("id")
        where = f"query '{qid}'"
        if not isinstance(qid, str) or not QUERY_ID_RE.match(qid):
            errors.append(f"query id '{qid}' must be lower_snake_case, 2-49 characters")
            continue
        if qid in seen:
            errors.append(f"{where}: duplicate query id")
            continue
        seen.add(qid)
        query_errs = validate_cube_query(entry.get("cube_query"), members, where)
        if query_errs:
            errors.extend(query_errs)
            continue
        good.append({
            "id": qid,
            "label": entry.get("label") or qid,
            "cube_query": entry["cube_query"],
        })
    return good, errors
