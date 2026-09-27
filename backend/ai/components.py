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

# Two controls, and which one a filter gets is derived from the member, not
# chosen by the model: a time dimension takes a date range, everything else
# takes a multi-select dropdown. Nothing textual is ever a free-text box or a
# single-choice select — picking from the values that exist beats typing one.
FILTER_TYPES = {"multiselect", "date_range"}

# A filter's operator follows from its type, for the same reason. The model
# once wrote `onOrAfter`, which Cube rejects, so every date filter threw and
# nothing refreshed.
FILTER_OPERATORS = {
    "multiselect": "equals",
    "date_range": ("afterOrOnDate", "beforeOrOnDate"),
}


def filter_type_for(member: str, members: dict) -> str:
    """The control a member gets. Time dimensions get a range; everything
    else gets a multi-select of its actual values."""
    return "date_range" if member in (members.get("time_dimensions") or set()) else "multiselect"


def normalize_filters(spec: dict, members: dict) -> None:
    """Rewrite each filter's type from its member, in place.

    The model may still declare a type; it is overwritten. Leaving the choice
    with the model produced single-choice selects and free-text boxes on
    dimensions that should have been pick-lists."""
    for f in spec.get("filters") or []:
        if isinstance(f, dict) and isinstance(f.get("member"), str):
            f["type"] = filter_type_for(f["member"], members)

SPANS = {"full": 12, "half": 6, "third": 4, "quarter": 3}
SIZES = {k: f"span {v}" for k, v in SPANS.items()}


def pack_rows(components: list) -> list:
    """Assign each component its final column span.

    The model picks a size by intent, but intent leaves ragged rows — one
    half-width chart alone on a row leaves half the page empty. So the spans
    the model asked for are packed greedily into 12-column rows and then
    stretched to fill the row exactly. Layout is arithmetic; the model should
    not be doing it."""
    rows, row, used = [], [], 0
    for c in components:
        span = SPANS.get(c.get("size", "half"), 6)
        if used + span > 12:
            rows.append((row, used))
            row, used = [], 0
        row.append((c, span))
        used += span
    if row:
        rows.append((row, used))

    out = []
    for row, used in rows:
        slack = 12 - used
        for i, (c, span) in enumerate(row):
            # Give the remainder to the widest member, and the last one takes
            # any rounding, so a row always adds up to exactly twelve.
            share = slack // len(row) + (slack % len(row) if i == len(row) - 1 else 0)
            out.append((c, span + share))
    return out


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
        member = f.get("member")
        if member not in members.get("all", set()):
            errors.append(f"{where}: member '{member}' does not exist in the semantic model")
            continue
        # The control is derived, so a wrong one is impossible rather than
        # an error the model has to be sent back to fix.
        f["type"] = filter_type_for(member, members)

    return errors


# ── Rendering ──────────────────────────────────────────────────────────────

def _esc(value) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def _filter_html(f: dict) -> str:
    """A filter control. The Cube member and the control are baked in here
    from validated values — the browser never decides either."""
    fid, label, member = f["id"], f["label"], f["member"]
    ftype = _stored_type(f)
    common = f'data-filter="{_esc(fid)}" data-member="{_esc(member)}" data-type="{_esc(ftype)}"'

    if ftype == "date_range":
        control = (
            f'<div class="cb-range">'
            f'<input type="date" {common} data-bound="from" aria-label="{_esc(label)} from">'
            f'<span class="cb-dash">\u2013</span>'
            f'<input type="date" {common} data-bound="to" aria-label="{_esc(label)} to">'
            f"</div>"
        )
    else:
        # A multi-select dropdown: a button opening a searchable checkbox
        # list. A native <select multiple> is a list box needing ctrl-click,
        # which is not what anyone means by a filter dropdown. Options are
        # filled at runtime from the member's distinct values.
        control = (
            f'<div class="cb-ms" {common}>'
            f'<button type="button" class="cb-ms-toggle" aria-haspopup="listbox" '
            f'aria-expanded="false"><span data-slot="summary">All</span>'
            f'<span class="cb-ms-caret" aria-hidden></span></button>'
            f'<div class="cb-ms-panel" role="listbox" aria-multiselectable="true" hidden>'
            f'<input type="search" class="cb-ms-search" placeholder="Search {_esc(label)}\u2026" '
            f'aria-label="Search {_esc(label)}">'
            f'<div class="cb-ms-options" data-slot="options"></div>'
            f'<p class="cb-ms-empty" data-slot="nomatch" hidden>No matches</p>'
            f'<div class="cb-ms-foot">'
            f'<button type="button" data-ms-clear>Clear</button>'
            f'<span data-slot="count"></span>'
            f"</div></div></div>"
        )

    return f'<div class="cb-filter"><label>{_esc(label)}</label>{control}</div>'


def _stored_type(f: dict) -> str:
    """The control for a filter already saved in a spec.

    Specs written before the controls were narrowed may carry a retired type
    ("select", "search"); anything that is not a date range is a multi-select
    now, so old artifacts keep rendering instead of failing on an unknown
    control."""
    return "date_range" if f.get("type") == "date_range" else "multiselect"


def _component_html(c: dict, span: int = 6) -> str:
    ctype = c["type"]
    size = f"span {span}"
    title = c.get("title") or ""

    if ctype == "text":
        return (
            f'<section class="cb-card cb-text" style="grid-column:{size}">'
            f'{f"<h3>{_esc(title)}</h3>" if title else ""}'
            f"<p>{_esc(c['body'])}</p></section>"
        )

    if ctype == "kpi":
        return (
            f'<section class="cb-card cb-kpi" data-cid="{_esc(c["id"])}">'
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

    kpis = [c for c in spec["components"] if c.get("type") == "kpi"]
    rest = [c for c in spec["components"] if c.get("type") != "kpi"]

    if kpis:
        parts.append('<div class="cb-kpis">')
        parts.extend(_component_html(c) for c in kpis)
        parts.append("</div>")

    if rest:
        parts.append('<main class="cb-grid">')
        parts.extend(_component_html(c, span) for c, span in pack_rows(rest))
        parts.append("</main>")
    return "\n".join(parts)


def grain_for(spec: dict) -> dict:
    """query id -> {column: granularity}, read from each query's timeDimensions.

    A date means different things at different granularities, and the value
    alone does not say which: 2025-01-01 is the whole of January in a monthly
    series, New Year's Day in a daily one, and midnight in an hourly one. The
    runtime used to guess from the value and so labelled a daily point landing
    on the 1st as "Jan 2025". The query already knows, so it is told."""
    out: dict = {}
    for q in spec.get("queries") or []:
        if not isinstance(q, dict):
            continue
        columns = {}
        for td in (q.get("cube_query") or {}).get("timeDimensions") or []:
            member, gran = td.get("dimension"), td.get("granularity")
            if isinstance(member, str) and gran:
                # Rows arrive with bare column names (see _flatten_key).
                columns[member.split(".")[-1]] = gran
        if columns:
            out[q.get("id")] = columns
    return out


def spec_payload(spec: dict) -> str:
    """The component/filter config the runtime reads. Only what the runtime
    needs to draw and query — no prose, no layout."""
    grain = grain_for(spec)
    slim = {
        "components": [
            {**{k: v for k, v in c.items() if k in
                ("id", "type", "query", "x", "y", "value", "category", "columns", "format", "title")},
             **({"grain": grain[c["query"]]} if c.get("query") in grain else {})}
            for c in spec["components"] if c.get("type") != "text"
        ],
        "filters": [
            {"id": f["id"], "member": f["member"], "type": _stored_type(f),
             "operators": FILTER_OPERATORS[_stored_type(f)]}
            for f in (spec.get("filters") or [])
        ],
    }
    return json.dumps(slim, default=str).replace("</", "<\\/")
