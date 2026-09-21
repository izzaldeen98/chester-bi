"""Validates the Cube queries the artifact agent writes against the live /meta
of the semantic model the user picked.

Nothing invalid is ever executed or stored: errors go back to the model for a
bounded number of retries (see ai/artifact.py), and whatever still fails is
dropped and reported.
"""
import re

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
