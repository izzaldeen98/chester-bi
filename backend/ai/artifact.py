"""Artifacts — LLM-authored, self-contained HTML analysis pages.

Two-phase so the model writes markup against real values instead of guessing:

  1. plan   — read the semantic model and WRITE the Cube queries the page needs
  2. write  — given the plan, the real columns and a few sample rows, emit the HTML

The agent is not limited to saved datasets: it composes its own Cube queries
from the cubes, measures and dimensions of the semantic model the user picked.
Every query is validated against the live /meta before it is executed or stored
(ai/validate.py::validate_queries), and re-validated on the retry turn.

The HTML never contains data. `render_page()` re-runs the stored queries and
injects the rows as `window.CHESTER` on every view, so an artifact is always
current, and the saved file carries nothing sensitive.

The page runs in a `sandbox="allow-scripts"` iframe with no allow-same-origin
(see frontend ArtifactViewPage): the model's JS gets an opaque origin, so it
cannot reach the app's DOM, cookies, storage or API. That isolation — not
sanitizing the markup — is what makes running generated code safe here.
"""
import html as html_lib
import json
import os
import re
from hashlib import sha256

from sqlalchemy.orm import Session

from ai.adapters import get_adapter
from ai.grounding import DEFAULT_TEXT_COLOR, PALETTE, cube_grounding
from ai.validate import MAX_LIMIT, validate_queries
from models.user import User
from security import decrypt_password
from utils.cube import load as cube_load, mint_token
from utils.redis_handler import cache_query, get_cached_query, redis_client

SAMPLE_ROWS = 5
MAX_RETRIES = 2
# Pinned so an artifact renders the same next year. Point at a self-hosted copy
# for air-gapped installs.
CHART_LIB_URL = os.getenv(
    "ARTIFACT_CHART_CDN", "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"
)

PLAN_SYSTEM = """\
You are planning an analytical HTML page ("artifact") for Chester BI.

You output JSON only. No prose, no markdown fence.

You are working against ONE semantic model: **{semantic_model}**. You write the queries
the page needs, directly against this model — there is no pre-built dataset to pick from.

### The semantic model (live Cube /meta)
{cube_context}

## Output format

{{"title": "short page title",
  "description": "one sentence",
  "queries": [
    {{"id": "lower_snake_case_id",
      "label": "what this query returns",
      "cube_query": {{"measures": ["Cube.measure"], "dimensions": ["Cube.dimension"],
                     "timeDimensions": [{{"dimension": "Cube.time_dim",
                                         "granularity": "month",
                                         "dateRange": "last 12 months"}}],
                     "filters": [{{"member": "Cube.dimension", "operator": "equals",
                                  "values": ["x"]}}],
                     "order": {{"Cube.measure": "desc"}},
                     "limit": 500}}}}
  ],
  "plan": "what the page shows: which visuals, what the narrative argues, which filters",
  "unmet": ["anything the brief asked for that this model cannot answer"]}}

## Rules for cube_query

1. Every measure must be a MEASURE of this model and every dimension a DIMENSION,
   spelled exactly as listed above, fully qualified as "Cube.field".
2. A query needs at least one measure or dimension.
3. timeDimensions entries name a time dimension. granularity is one of second, minute,
   hour, day, week, month, quarter, year. dateRange is a string like "last 12 months"
   or a ["2024-01-01", "2024-12-31"] pair.
4. Filter operators: equals, notEquals, contains, notContains, startsWith, notStartsWith,
   endsWith, notEndsWith, gt, gte, lt, lte, set, notSet, inDateRange, notInDateRange,
   beforeDate, beforeOrOnDate, afterDate, afterOrOnDate. Every operator except set and
   notSet needs a non-empty "values" array of STRINGS.
5. order may only reference members the query selects.
6. Do NOT add a dateRange unless the brief asks for a specific period. The data is
   historical and may end well before today — "last 12 months" often matches nothing.
   With no dateRange the query covers whatever the data actually holds.
7. limit is an integer, at most {max_limit}. Always set one on a detail/breakdown query —
   the whole result is embedded in the page.
8. Only these keys are allowed: measures, dimensions, timeDimensions, filters, segments,
   order, limit, offset, timezone, ungrouped.

## Judgment

Write the FEWEST queries that answer the brief — one per distinct shape of data
(headline totals, a trend over time, a breakdown by dimension, a detail table). Do not
write one query per chart when several charts read the same rows. Give each a stable,
descriptive id: the page reads its rows from window.CHESTER.data["<that id>"].\
"""

WRITE_SYSTEM = """\
You are writing a self-contained analytical HTML page ("artifact") for Chester BI.

You output raw HTML and nothing else — no JSON, no prose, no explanation, no markdown
fence. Your first character is "<".

## The plan you are implementing
{plan}

## How your page gets its data

There is no data in your page. Every chart fetches its own rows at runtime from
a runtime the host already provides — you never write the fetching, only the call.

    const rows = await CHESTER.query('revenue_by_customer');
    // rows: [ {{column: value, ...}}, ... ]

Each query id below is one component's data. One chart, one query.

    CHESTER.meta          // {{ queryId: {{ name, columns }} }} — what you may ask for
    CHESTER.theme.colors  // the series palette, in order
    CHESTER.onData(cb)    // cb(queryId, rows) — fires whenever rows arrive

## Cross-filtering — this is what makes it a dashboard

Filter controls do NOT filter arrays in JavaScript. They set a Cube filter and the
affected charts re-query the database:

    CHESTER.setFilter('region', {{
      member: 'customers.region', operator: 'equals', values: [value]
    }});
    CHESTER.clearFilter('region');
    CHESTER.clearAllFilters();

`setFilter` returns a promise and re-runs every component. Redraw inside
`CHESTER.onData((id, rows) => ...)` so a chart updates whenever its rows land,
including on first load. A chart may also be clickable to set a filter — that is
how one chart cross-filters the rest.

`member` must be a real dimension of the semantic model, fully qualified, exactly as
listed in the plan's queries.

## The queries this page owns, with their columns and a sample of current rows

{samples}

The sample is to show you column names and value shapes ONLY. Never hardcode it, never
ship it, never compute totals from it — the real rows arrive from CHESTER.query and
will differ. Always render from what the promise resolves to, and handle an empty array.

## What to build

- Use `echarts` — it is already loaded as a global (v5). Do not load any other library,
  and do not add <script src> tags: external requests other than the chart library are
  blocked.
- Visuals: charts that fit the question (trend, comparison, composition, distribution).
  Size them with explicit pixel heights; echarts needs a sized container.
- Narrative: real sentences computed from the data — totals, deltas, the largest mover,
  what stands out. Not lorem, not placeholders, not "insights will appear here".
- Filters: working HTML controls (selects, date inputs, search boxes) that re-filter the
  arrays in JS and re-render the charts and the narrative. They must actually work.
- Make it good-looking and responsive: a title, a summary line, a KPI row, a chart grid
  that collapses to one column under 700px.

## House style — the page is embedded in the Chester BI app, so it must match it

- Background #fbfbfa. Cards and panels: #ffffff, 1px solid #e7e6e2, border-radius 12px,
  box-shadow 0 1px 2px rgba(23,22,20,0.05). Never a coloured card background.
- Text: #171614 for headings and figures, #5f5d57 for body, #716e68 for labels. Headings
  use letter-spacing -0.021em and font-weight 600. Never pure black, never pure grey.
- Font stack, on every element including inputs and buttons:
  font-family: "Geist Sans", ui-sans-serif, system-ui, -apple-system, sans-serif.
  Use tabular figures for every number: font-variant-numeric: tabular-nums.
- Series colours, in this order: {palette}. Do not introduce any other hue.
- Style every filter control yourself — a bare browser <select> or date input breaks the
  page. Give them: appearance:none, background #ffffff, 1px solid #d6d4ce, radius 6px,
  padding 6px 10px, font-size 13.5px, and a custom caret. Labels above them at 11px
  #716e68. A date range is two text inputs with placeholder YYYY-MM-DD, not
  <input type="date">.
- Buttons: primary is background #171614 with #ffffff text, radius 6px, 13px, weight 500.
  Secondary is white with a #d6d4ce border. No coloured buttons.
- Spacing: 24px page padding, 16px between cards, 12px inside them.

## Output contract

Emit everything that goes INSIDE <body> — your own <style> and <script> included. The
host supplies <!doctype>, <head>, the chart library and the data script. Do not emit
<!doctype>, <html>, <head> or <body> tags.

Write plain, boring JavaScript: no modules, no imports, no frameworks, no fetch, no
localStorage (the page runs sandboxed with an opaque origin — both throw). Use
CHESTER.query for data; it is the only way in and it is already loaded.

Render in this order, every time:
1. Build the layout and the empty chart containers immediately, on script run.
2. Show a quiet loading state in each chart.
3. Register CHESTER.onData to draw or redraw a chart when its rows arrive.
4. Call CHESTER.query(id) for each component to start the first load.

Never block the whole page on one query, and never assume a query has resolved
before drawing — a slow cube must not leave the page blank.\
"""

REFINE_SYSTEM = """\
You are changing one existing Chester BI artifact — a self-contained HTML page.

You output raw HTML and nothing else — no JSON, no prose, no markdown fence. Your first
character is "<".

Return the COMPLETE markup, not a diff or a fragment. Keep everything the request does
not ask you to change: same structure, same data wiring, same working filters.

The runtime contract is unchanged: rows come from `await CHESTER.query('<queryId>')`,
filters go through `CHESTER.setFilter(key, cubeFilter)` and redraws happen in
`CHESTER.onData((id, rows) => ...)`. `echarts` is a loaded global, your markup goes
inside <body>, and no external scripts, fetches or storage are available. There is no
data in the page — never bake rows in.

The queries this page reads, with their columns and sample rows:
{samples}

## The page as it stands
{current_html}\
"""


def _parse_json(text: str) -> dict:
    text = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        text = fence.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise Exception(f"Model did not return JSON: {text[:300]}")
        return json.loads(text[start:end + 1])


def _parse_markup(text: str) -> str:
    """The write/refine turns answer with raw HTML rather than JSON: escaping a
    20KB document into a JSON string field is how a single stray backslash
    ("Invalid \\escape") throws the whole page away. Strip a fence if the model
    adds one anyway, and drop any full-document wrapper — the host supplies
    <!doctype>/<head>."""
    text = text.strip()
    fence = re.match(r"^```(?:html)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        text = fence.group(1).strip()
    body = re.search(r"<body[^>]*>(.*)</body>", text, re.S | re.I)
    if body:
        text = body.group(1).strip()
    else:
        text = re.sub(r"^<!doctype[^>]*>\s*", "", text, flags=re.I).strip()
    if not text.startswith("<"):
        raise Exception(f"Model did not return HTML: {text[:200]}")
    return text


def _flatten_key(key: str) -> str:
    """Cube keys rows as "Cube.field" (or "Cube.field.granularity" for time
    dimensions). Generated JS is far easier to write — and far easier to get
    right — against bare column names."""
    parts = key.split(".")
    return parts[1] if len(parts) >= 2 else key


def flatten_rows(rows: list) -> list:
    return [{_flatten_key(k): v for k, v in row.items()} for row in rows]


def merge_filters(cube_query: dict, extra: list | None) -> dict:
    """A component's *effective* query: its stored cube_query with the
    dashboard's currently-applied filters merged in. Cube ANDs the top-level
    filters array, so appending is the whole merge.

    The stored query is never mutated — filters are a view over it, which is
    what lets one component be re-queried without touching the saved spec."""
    if not extra:
        return dict(cube_query or {})
    merged = dict(cube_query or {})
    merged["filters"] = list(merged.get("filters") or []) + list(extra)
    return merged


def query_fingerprint(account_key, query: dict) -> str:
    """A stable hash of an effective query. Two components with the same
    effective query share a cache entry; changing a filter changes the hash,
    which is precisely the set that has to be re-fetched."""
    canonical = json.dumps(query, sort_keys=True, separators=(",", ":"), default=str)
    return f"artifact_q:{account_key}:{sha256(canonical.encode()).hexdigest()[:24]}"


def run_query(db: Session, user: User, cube_query: dict, extra_filters: list | None = None,
              limit: int | None = None) -> tuple[list, bool]:
    """Executes one effective query against Cube, via the app-level Redis
    manifest. Returns (rows, served_from_cache).

    Cube keeps its own result cache (Cube Store); this layer exists so the
    runtime can tell which components actually need re-fetching when a filter
    changes, rather than reloading the whole page."""
    effective = merge_filters(cube_query, extra_filters)
    if limit:
        effective["limit"] = limit

    key = query_fingerprint(user.account.public_key, effective)
    try:
        hit = get_cached_query(key)
        if hit is not None:
            return hit["rows"], True
    except Exception:
        pass  # no Redis in this environment — fall through to Cube

    token = mint_token(db, user.account.public_key, user.account_id)
    rows = flatten_rows(cube_load(token, effective).get("data", []))
    try:
        cache_query(key, {"rows": rows})
    except Exception:
        pass
    return rows, False


def invalidate_query(account_key, cube_query: dict) -> None:
    """Drop the unfiltered entry for a query whose definition just changed.
    Filtered variants age out on their own TTL; the unfiltered one is the
    entry a reader hits first, so it is the one worth busting immediately."""
    try:
        redis_client.delete(query_fingerprint(account_key, dict(cube_query or {})))
    except Exception:
        pass


def fetch_data(db: Session, user: User, queries: list, limit: int | None = None) -> dict:
    """{queryId: rows} straight from Cube, one /load per stored query.

    `limit` overrides each query's own limit — used to pull a handful of sample
    rows for the write turn without fetching the full result."""
    token = mint_token(db, user.account.public_key, user.account_id)
    out = {}
    for entry in queries:
        query = dict(entry.get("cube_query") or {})
        if limit:
            query["limit"] = limit
        out[entry["id"]] = flatten_rows(cube_load(token, query).get("data", []))
    return out


def _record_columns(queries: list, sample: dict) -> None:
    """Stamp each query with the columns it actually returned. The rendered
    page reads these to build its layout before any rows arrive."""
    for entry in queries:
        rows = sample.get(entry["id"]) or []
        if rows:
            entry["columns"] = sorted(rows[0].keys())


def _samples_block(queries: list, sample: dict) -> str:
    blocks = []
    for entry in queries:
        rows = sample.get(entry["id"], [])
        columns = sorted(rows[0].keys()) if rows else []
        blocks.append(
            f'queryId "{entry["id"]}" — {entry.get("label") or entry["id"]}\n'
            f"  columns: {json.dumps(columns)}\n"
            f"  rows returned: {len(rows)}\n"
            f"  sample rows: {json.dumps(rows[:SAMPLE_ROWS], default=str)}"
        )
    return "\n\n".join(blocks) or "(no queries)"


def _adapter_for(provider_row):
    return get_adapter(
        provider_row.provider, decrypt_password(provider_row.api_key_enc), provider_row.base_url
    )


def _plan(adapter, model: str, system: str, user_msg: str, members: dict) -> tuple[list, dict]:
    """Plan turn with a bounded validation loop: invalid Cube queries go back to
    the model with the errors rather than reaching Cube or the saved artifact."""
    plan_out, errors = {}, []
    for attempt in range(MAX_RETRIES + 1):
        # No effort hint on any turn. Measured on gpt-5: effort="high" here
        # tripled reasoning tokens (2,368 -> 6,912) and latency (36s -> 134s)
        # for no better queries, and effort="low" on the write turn is
        # unmeasured. Adapters accept `effort` if a future measurement earns it;
        # until then the provider default wins. The real cost lever is which
        # model the provider is set to, not this flag.
        plan_out = _parse_json(adapter.generate(system, user_msg, model))
        queries, errors = validate_queries(plan_out.get("queries"), members)
        if queries and not errors:
            return queries, plan_out
        if attempt == MAX_RETRIES:
            if queries:
                return queries, plan_out       # keep what is valid
            raise Exception(
                "The model could not write a valid query against this semantic model: "
                + "; ".join(errors[:5])
            )
        user_msg = (
            f"{user_msg}\n\nYour previous answer had invalid queries. Return the FULL "
            "corrected JSON, fixing these and keeping what was already valid:\n- "
            + "\n- ".join(errors)
        )
    raise Exception("; ".join(errors[:5]))


def generate(db: Session, user: User, provider_row, model: str, brief: str, theme: str,
             semantic_model=None, allowed_cubes: set | None = None) -> dict:
    """Returns {title, description, queries, html, unmet}."""
    cube_context, members = cube_grounding(
        db, user.account.public_key, user.account_id, allowed_cubes
    )
    if not members["all"]:
        where = f'the semantic model "{semantic_model.name}"' if semantic_model is not None else "this account"
        raise Exception(f"{where} exposes no cubes — define one under Models first.")

    adapter = _adapter_for(provider_row)
    queries, plan_out = _plan(
        adapter, model,
        PLAN_SYSTEM.format(
            semantic_model=(semantic_model.name if semantic_model is not None else "all models"),
            cube_context=cube_context,
            max_limit=MAX_LIMIT,
        ),
        f"Brief:\n{brief}",
        members,
    )

    # Phase 2 — write the page against real column names and sample rows.
    sample = fetch_data(db, user, queries, limit=SAMPLE_ROWS)
    _record_columns(queries, sample)
    colors = PALETTE.get(theme, PALETTE["chester"])
    markup = _parse_markup(adapter.generate(
        WRITE_SYSTEM.format(
            plan=json.dumps({k: plan_out.get(k) for k in ("title", "description", "plan")}, indent=1),
            samples=_samples_block(queries, sample),
            palette=", ".join(colors),
            text_color=DEFAULT_TEXT_COLOR,
        ),
        f"Brief:\n{brief}",
        model,
        json_mode=False,
    ))

    return {
        "title": plan_out.get("title") or "Untitled artifact",
        "description": plan_out.get("description") or brief[:127],
        "queries": queries,
        "html": markup,
        "usage": dict(adapter.total),
        "unmet": plan_out.get("unmet") or [],
        # A valid query can still match nothing (a date range past the end of the
        # data). Say so rather than shipping an empty chart with no explanation.
        "empty": [q["id"] for q in queries if not sample.get(q["id"])],
    }


def refine(db: Session, user: User, provider_row, model: str, current_html: str,
           queries: list, instruction: str, semantic_model=None,
           allowed_cubes: set | None = None) -> dict:
    """Whole-page edit. Replans the queries first, so a request for data the page
    does not yet have ("add a breakdown by region") can actually be satisfied.
    Returns {queries, html}."""
    cube_context, members = cube_grounding(
        db, user.account.public_key, user.account_id, allowed_cubes
    )
    adapter = _adapter_for(provider_row)

    new_queries, _ = _plan(
        adapter, model,
        PLAN_SYSTEM.format(
            semantic_model=(semantic_model.name if semantic_model is not None else "all models"),
            cube_context=cube_context,
            max_limit=MAX_LIMIT,
        ),
        "The page already reads these queries:\n"
        + json.dumps(queries, indent=1)
        + f"\n\nChange request:\n{instruction}\n\n"
        "Return the FULL query set the page needs after this change. Keep every query "
        "that is still used, with the same id, unchanged.",
        members,
    )

    sample = fetch_data(db, user, new_queries, limit=SAMPLE_ROWS)
    _record_columns(new_queries, sample)
    markup = _parse_markup(adapter.generate(
        REFINE_SYSTEM.format(samples=_samples_block(new_queries, sample), current_html=current_html),
        f"Change request:\n{instruction}",
        model,
        json_mode=False,
    ))
    return {"queries": new_queries, "html": markup, "usage": dict(adapter.total)}


RUNTIME_JS = """
/* Chester artifact runtime — shipped with the app, never written by the LLM.

   The page runs sandboxed with an opaque origin, so it cannot call the API
   itself: no cookies, no credentials, no same-origin. Instead it asks the
   parent app, which is authenticated, and the parent answers. That keeps the
   sandbox intact while making every chart a live query.

   Contract for the page:
     await CHESTER.query('revenue_by_customer')   -> rows for that component
     CHESTER.setFilter('region', {...cubeFilter}) -> re-runs affected charts
     CHESTER.clearFilter('region')
     CHESTER.onData(cb)  -> cb(id, rows) whenever a component's rows arrive
*/
(function () {
  var pending = {}, seq = 0, filters = {}, listeners = [], cache = {};

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== 'chester-host') return;
    var p = pending[m.rid];
    if (!p) return;
    delete pending[m.rid];
    if (m.error) p.reject(new Error(m.error));
    else p.resolve(m.rows);
  });

  function ask(id, extra) {
    var rid = ++seq;
    return new Promise(function (resolve, reject) {
      pending[rid] = { resolve: resolve, reject: reject };
      parent.postMessage(
        { source: 'chester-page', rid: rid, queryId: id, filters: extra },
        '*'
      );
      setTimeout(function () {
        if (pending[rid]) { delete pending[rid]; reject(new Error('Query timed out')); }
      }, 60000);
    });
  }

  function activeFilters() {
    var out = [];
    for (var k in filters) if (filters[k]) out.push(filters[k]);
    return out;
  }

  var CHESTER = {
    meta: window.__CHESTER_META__ || {},
    theme: window.__CHESTER_THEME__ || {},

    /* Rows for one component, honouring every active filter. Repeated calls
       with the same effective filters are served from the page's own map so
       a re-render never re-asks. */
    query: function (id) {
      var sig = id + '|' + JSON.stringify(activeFilters());
      if (cache[sig]) return cache[sig];
      var pr = ask(id, activeFilters()).then(function (rows) {
        listeners.forEach(function (cb) { try { cb(id, rows); } catch (_) {} });
        return rows;
      });
      cache[sig] = pr;
      return pr;
    },

    /* Cross-filter. Setting or clearing one re-runs only the components that
       actually read data — the page decides what to redraw via onData. */
    setFilter: function (key, cubeFilter) {
      filters[key] = cubeFilter;
      return CHESTER.refresh();
    },
    clearFilter: function (key) {
      delete filters[key];
      return CHESTER.refresh();
    },
    clearAllFilters: function () {
      filters = {};
      return CHESTER.refresh();
    },
    activeFilters: activeFilters,

    refresh: function () {
      cache = {};
      var ids = Object.keys(CHESTER.meta);
      return Promise.all(ids.map(function (id) { return CHESTER.query(id); }));
    },

    onData: function (cb) { listeners.push(cb); },
  };

  window.CHESTER = CHESTER;
})();
"""


def render_page(markup: str, manifest: dict, theme: str, title: str = "Artifact") -> str:
    """Wraps the model's markup into a full document.

    No rows are baked in. The page receives a manifest of what it may query
    plus the runtime that fetches it, so every open reflects the current data
    and a filter change re-queries rather than filtering a frozen array."""
    payload = json.dumps(
        {
            "meta": manifest,
            "theme": {"colors": PALETTE.get(theme, PALETTE["chester"]), "text": DEFAULT_TEXT_COLOR},
        },
        default=str,
    ).replace("</", "<\\/")
    return (
        "<!doctype html>\n<html><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{html_lib.escape(title)}</title>"
        "<style>body{margin:0;font:14px 'Geist Sans',ui-sans-serif,system-ui,-apple-system,sans-serif;"
        "background:#fbfbfa;color:#171614}</style>"
        f"<script src='{html_lib.escape(CHART_LIB_URL, quote=True)}'></script>"
        f"<script>(function(){{var b={payload};"
        "window.__CHESTER_META__=b.meta;window.__CHESTER_THEME__=b.theme;}})();</script>"
        f"<script>{RUNTIME_JS}</script>"
        f"</head><body>\n{markup}\n</body></html>"
    )
