"""Pre-built artifact components.

The LLM used to write the whole page — layout, chart JS, filter wiring — and
it got infrastructure wrong in ways that only showed at runtime: invented Cube
operators, filters that never re-queried, charts that never redrew.

So it no longer writes any of that. It emits a small JSON spec naming which
component goes where and which query feeds it, and this module renders the
page: hand-written HTML plus a hand-written runtime, identical for every
artifact. The model configures; it never implements.

That also makes generation cheap. A spec is ~1-2k tokens against ~12k for a
page, and there is no second "write the HTML" turn at all.
"""
import html
import json

# ── What the model may ask for ─────────────────────────────────────────────
# Each entry: the fields the spec must supply, and which of them name columns
# of the component's query (so they can be checked against real data).
COMPONENT_TYPES = {
    "kpi":   {"required": ["query", "value"],       "columns": ["value"]},
    "bar":   {"required": ["query", "x", "y"],      "columns": ["x", "y"]},
    "line":  {"required": ["query", "x", "y"],      "columns": ["x", "y"]},
    "area":  {"required": ["query", "x", "y"],      "columns": ["x", "y"]},
    "pie":   {"required": ["query", "category", "value"], "columns": ["category", "value"]},
    "table": {"required": ["query"],                "columns": ["columns"]},
    "text":  {"required": ["body"],                 "columns": []},
}

FILTER_TYPES = {"select", "multiselect", "date_range", "search"}

# A filter's operator is decided here, from its type — never by the model.
# This is what killed the old pages: the LLM wrote `onOrAfter`, which Cube
# rejects, so every date filter threw and nothing refreshed.
FILTER_OPERATORS = {
    "select": "equals",
    "multiselect": "equals",
    "search": "contains",
    "date_range": ("afterOrOnDate", "beforeOrOnDate"),
}

SIZES = {"full": "span 12", "half": "span 6", "third": "span 4", "quarter": "span 3"}


def validate_spec(spec: dict, queries: list, members: dict) -> list[str]:
    """Check a spec against the real queries and the live semantic model.

    Returns human-readable errors for the retry turn. Everything the page will
    later do at runtime is decided here, so a spec that passes cannot produce
    a broken filter or a chart bound to a column that does not exist."""
    errors: list[str] = []
    by_id = {q["id"]: q for q in queries}

    components = spec.get("components")
    if not isinstance(components, list) or not components:
        return ["spec.components must be a non-empty array"]

    seen: set[str] = set()
    for i, c in enumerate(components):
        where = f"components[{i}]"
        if not isinstance(c, dict):
            errors.append(f"{where} must be an object")
            continue

        cid = c.get("id")
        if not isinstance(cid, str) or not cid:
            errors.append(f"{where}: needs a string id")
            continue
        if cid in seen:
            errors.append(f"{where}: duplicate component id '{cid}'")
        seen.add(cid)

        ctype = c.get("type")
        if ctype not in COMPONENT_TYPES:
            errors.append(f"{where}: type '{ctype}' is unknown "
                          f"(allowed: {', '.join(sorted(COMPONENT_TYPES))})")
            continue

        spec_def = COMPONENT_TYPES[ctype]
        for field in spec_def["required"]:
            if not c.get(field):
                errors.append(f"{where} ({ctype}): '{field}' is required")

        if ctype == "text":
            continue

        query = by_id.get(c.get("query"))
        if query is None:
            errors.append(f"{where}: query '{c.get('query')}' is not one of the "
                          f"planned queries ({', '.join(by_id) or 'none'})")
            continue

        columns = set(query.get("columns") or [])
        if not columns:
            continue  # the query returned nothing to check against

        for field in spec_def["columns"]:
            val = c.get(field)
            if val is None:
                continue
            for name in (val if isinstance(val, list) else [val]):
                if name not in columns:
                    errors.append(
                        f"{where} ({ctype}): '{field}' references column '{name}', which "
                        f"query '{query['id']}' does not return. It has: {sorted(columns)}"
                    )

        size = c.get("size", "half")
        if size not in SIZES:
            errors.append(f"{where}: size '{size}' must be one of {', '.join(SIZES)}")

    for i, f in enumerate(spec.get("filters") or []):
        where = f"filters[{i}]"
        if not isinstance(f, dict):
            errors.append(f"{where} must be an object")
            continue
        if not f.get("id") or not f.get("label"):
            errors.append(f"{where}: needs an id and a label")
        ftype = f.get("type")
        if ftype not in FILTER_TYPES:
            errors.append(f"{where}: type '{ftype}' must be one of {', '.join(sorted(FILTER_TYPES))}")
        member = f.get("member")
        if member not in members.get("all", set()):
            errors.append(f"{where}: member '{member}' does not exist in the semantic model")
        elif ftype == "date_range" and member not in members.get("time_dimensions", set()):
            errors.append(f"{where}: '{member}' is not a time dimension, so it cannot be a date_range")

    return errors


# ── Rendering ──────────────────────────────────────────────────────────────

def _esc(value) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def _filter_html(f: dict) -> str:
    """A filter control. The operator and the Cube member are baked in here,
    from validated spec values — the browser never decides either."""
    fid, label, ftype, member = f["id"], f["label"], f["type"], f["member"]
    common = f'data-filter="{_esc(fid)}" data-member="{_esc(member)}" data-type="{_esc(ftype)}"'

    if ftype == "date_range":
        control = (
            f'<div class="cb-range">'
            f'<input type="date" {common} data-bound="from" aria-label="{_esc(label)} from">'
            f'<span class="cb-dash">–</span>'
            f'<input type="date" {common} data-bound="to" aria-label="{_esc(label)} to">'
            f"</div>"
        )
    elif ftype == "search":
        control = f'<input type="search" {common} placeholder="Search…" aria-label="{_esc(label)}">'
    else:
        multiple = " multiple size=\"4\"" if ftype == "multiselect" else ""
        # Options are filled at runtime from the member's distinct values.
        control = f'<select {common}{multiple} aria-label="{_esc(label)}"><option value="">All</option></select>'

    return f'<div class="cb-filter"><label>{_esc(label)}</label>{control}</div>'


def _component_html(c: dict) -> str:
    ctype = c["type"]
    size = SIZES.get(c.get("size", "half"), SIZES["half"])
    title = c.get("title") or ""

    if ctype == "text":
        return (
            f'<section class="cb-card cb-text" style="grid-column:{size}">'
            f'{f"<h3>{_esc(title)}</h3>" if title else ""}'
            f"<p>{_esc(c['body'])}</p></section>"
        )

    if ctype == "kpi":
        return (
            f'<section class="cb-card cb-kpi" style="grid-column:{size}" data-cid="{_esc(c["id"])}">'
            f'<span class="cb-kpi-label">{_esc(c.get("label") or title)}</span>'
            f'<span class="cb-kpi-value" data-slot="value">—</span>'
            f'<span class="cb-state" data-slot="state"></span>'
            f"</section>"
        )

    if ctype == "table":
        return (
            f'<section class="cb-card" style="grid-column:{size}" data-cid="{_esc(c["id"])}">'
            f'{f"<h3>{_esc(title)}</h3>" if title else ""}'
            f'<div class="cb-table-wrap" data-slot="table"></div>'
            f'<span class="cb-state" data-slot="state"></span>'
            f"</section>"
        )

    # Every chart type shares one shell; the runtime picks the ECharts option.
    return (
        f'<section class="cb-card" style="grid-column:{size}" data-cid="{_esc(c["id"])}">'
        f'{f"<h3>{_esc(title)}</h3>" if title else ""}'
        f'<div class="cb-chart" data-slot="chart"></div>'
        f'<span class="cb-state" data-slot="state"></span>'
        f"</section>"
    )


def render_body(spec: dict) -> str:
    """The page body: header, filter bar, component grid. Deterministic — the
    same spec always produces the same markup, so components always align."""
    parts = ['<header class="cb-head">']
    parts.append(f'<h1>{_esc(spec.get("title") or "Artifact")}</h1>')
    if spec.get("summary"):
        parts.append(f'<p class="cb-sub">{_esc(spec["summary"])}</p>')
    parts.append("</header>")

    filters = spec.get("filters") or []
    if filters:
        parts.append('<div class="cb-filters" role="group" aria-label="Filters">')
        parts.extend(_filter_html(f) for f in filters)
        parts.append('<button type="button" class="cb-clear" data-clear-all>Clear all</button>')
        parts.append("</div>")

    parts.append('<main class="cb-grid">')
    parts.extend(_component_html(c) for c in spec["components"])
    parts.append("</main>")
    return "\n".join(parts)


def spec_payload(spec: dict) -> str:
    """The component/filter config the runtime reads. Only what the runtime
    needs to draw and query — no prose, no layout."""
    slim = {
        "components": [
            {k: v for k, v in c.items() if k in
             ("id", "type", "query", "x", "y", "value", "category", "columns", "format", "title")}
            for c in spec["components"] if c.get("type") != "text"
        ],
        "filters": [
            {"id": f["id"], "member": f["member"], "type": f["type"],
             "operators": FILTER_OPERATORS[f["type"]]}
            for f in (spec.get("filters") or [])
        ],
    }
    return json.dumps(slim, default=str).replace("</", "<\\/")
