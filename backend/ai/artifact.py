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
import pathlib
import re
from hashlib import sha256

from sqlalchemy.orm import Session

from ai import components
from ai.adapters import get_adapter
from ai.grounding import DEFAULT_TEXT_COLOR, PALETTE, cube_grounding
from ai.validate import DEFAULT_QUERY_LIMIT, MAX_LIMIT, validate_queries
from models.user import User
from security import decrypt_password
from utils.cube import load as cube_load, mint_token
from utils.redis_handler import cache_query, get_cached_query, redis_client

# Tuning, not policy — every one is configurable, because what suits one
# deployment's data volume and model count will not suit another's.
SAMPLE_ROWS = int(os.getenv("ARTIFACT_SAMPLE_ROWS", "5"))
MAX_RETRIES = int(os.getenv("ARTIFACT_MAX_RETRIES", "2"))
# Pinned so an artifact renders the same next year. Point at a self-hosted copy
# for air-gapped installs.
CHART_LIB_URL = os.getenv(
    "ARTIFACT_CHART_CDN", "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"
)

PLAN_SYSTEM = """\
You design analytical pages ("artifacts") for Chester BI.

You output JSON only. No prose, no markdown fence, no HTML — the page itself is
assembled from pre-built components by the application, not by you.

You are working against ONE semantic model: **{semantic_model}**.

### The semantic model (live Cube /meta)
{cube_context}

## Output

{{"title": "...",
  "summary": "one or two sentences a reader sees under the title",
  "queries": [
    {{"id": "lower_snake_case", "label": "what this returns",
      "cube_query": {{"measures": ["Cube.measure"], "dimensions": ["Cube.dimension"],
                     "timeDimensions": [{{"dimension": "Cube.time", "granularity": "month"}}],
                     "order": {{"Cube.measure": "desc"}}, "limit": {default_limit}}}}}
  ],
  "filters": [
    {{"id": "region", "label": "Region", "member": "Cube.dimension",
      "type": "select|multiselect|date_range|search"}}
  ],
  "components": [
    {{"id": "kpi_revenue", "type": "kpi", "query": "totals", "value": "total_revenue",
      "label": "Revenue", "format": "currency", "size": "quarter"}},
    {{"id": "by_customer", "type": "bar", "query": "by_customer", "title": "Revenue by customer",
      "x": "customer_name", "y": ["total_revenue"], "format": "currency", "size": "half"}}
  ],
  "unmet": ["anything the brief asked for that this model cannot answer"]}}

## cube_query rules

1. Measures must be MEASURES of this model, dimensions must be DIMENSIONS, spelled
   exactly and fully qualified as "Cube.field".
2. timeDimensions name a time dimension; granularity is one of second, minute, hour,
   day, week, month, quarter, year.
3. Do NOT add a dateRange. The data is historical and may end well before today, and
   the reader filters by date themselves.
4. order may only reference members the query selects. limit is at most {max_limit}.
5. Only these keys: measures, dimensions, timeDimensions, filters, segments, order,
   limit, offset, timezone, ungrouped. A breakdown or detail query should set a limit;
   {default_limit} is a sensible default.

## Component rules

- Types: kpi, bar, line, area, pie, table, text.
- Every component except `text` names a `query`, and every field it references
  (`value`, `x`, `y`, `category`, `columns`) must be a COLUMN that query returns.
  A column is the part of the member after the dot: "loads.total_revenue" returns
  the column "total_revenue".
- `y` is an array; one entry per series.
- `format` is one of currency, percent, decimal, number.
- `size` is quarter, third, half or full — twelve columns to a row. KPIs are usually
  quarter; a table or a trend is usually full.
- `text` takes a `body` string: real observations, not placeholders. Use it when the
  brief asks for a written summary.

## Filter rules

- `member` must be a real dimension of this model, fully qualified.
- `date_range` requires a time dimension. Use `select` for a low-cardinality dimension,
  `multiselect` when several values are usefully combined, `search` for free text.
- Filters apply to EVERY component, re-querying the database — you do not wire them.

## Judgment

Lead with 3-5 KPIs, then the trend, then the breakdown, then detail. Write the fewest
queries that serve the components — several components may share one query. A component
that restates the one above it is noise.\
"""

REFINE_SYSTEM = """\
You are changing one existing Chester BI artifact.

You output JSON only — the COMPLETE updated spec, in exactly the same shape you were
given. No prose, no markdown fence, no HTML: the page is assembled from pre-built
components by the application.

Keep everything the request does not ask you to change, with the same ids, so unchanged
components keep their place and their cached data.

All the rules from the design brief still apply: component types and their required
fields, columns that must exist in the named query, filter members that must exist in
the semantic model, and the cube_query key list.

The queries this page reads, with their columns and sample rows:
{samples}

## The spec as it stands
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


def _require_scope(semantic_model, allowed_cubes):
    """A named model must arrive with its cube scope.

    Both callers default allowed_cubes to None for the genuinely unscoped
    case, so a caller that forgets to pass it would silently ground the agent
    in every cube in the account. Refusing here means isolation cannot be
    lost by omission at a call site."""
    if semantic_model is not None and not allowed_cubes:
        raise Exception(
            f'Refusing to build against "{semantic_model.name}" without its cube scope — '
            "this would expose every model in the account to the agent."
        )


def generate(db: Session, user: User, provider_row, model: str, brief: str, theme: str,
             semantic_model=None, allowed_cubes: set | None = None) -> dict:
    """One LLM turn produces the whole spec — queries, filters and components.

    There is no second turn writing HTML: the page is assembled from pre-built
    components, so the model's entire output is a small JSON config. That is
    both far cheaper and the reason components always line up."""
    _require_scope(semantic_model, allowed_cubes)
    cube_context, members = cube_grounding(
        db, user.account.public_key, user.account_id, allowed_cubes
    )
    if not members["all"]:
        where = f'the semantic model "{semantic_model.name}"' if semantic_model is not None else "this account"
        raise Exception(f"{where} exposes no cubes — define one under Models first.")

    adapter = _adapter_for(provider_row)
    system = PLAN_SYSTEM.format(
        semantic_model=(semantic_model.name if semantic_model is not None else "all models"),
        cube_context=cube_context,
        max_limit=MAX_LIMIT,
        default_limit=DEFAULT_QUERY_LIMIT,
    )
    spec, queries = _spec_turn(db, user, adapter, model, system, f"Brief:\n{brief}", members)

    sample = fetch_data(db, user, queries, limit=SAMPLE_ROWS)
    return {
        "title": spec.get("title") or "Untitled artifact",
        "description": (spec.get("summary") or brief)[:255],
        "queries": queries,
        "spec": spec,
        "usage": dict(adapter.total),
        "unmet": spec.get("unmet") or [],
        "empty": [q["id"] for q in queries if not sample.get(q["id"])],
    }


def _spec_turn(db, user, adapter, model, system, user_msg, members) -> tuple[dict, list]:
    """Ask for a spec and validate the whole thing — Cube queries against the
    live model, then components and filters against the columns those queries
    actually return. Errors go back to the model, bounded."""
    errors: list[str] = []
    for attempt in range(MAX_RETRIES + 1):
        spec = _parse_json(adapter.generate(system, user_msg, model))
        queries, errors = validate_queries(spec.get("queries"), members)

        if queries:
            # Columns can only be known by running the queries, and components
            # are validated against them — so this runs before the spec check.
            try:
                _record_columns(queries, fetch_data(db, user, queries, limit=SAMPLE_ROWS))
            except Exception as exc:
                errors.append(f"a query failed against Cube: {exc}")
            errors += components.validate_spec(spec, queries, members)

        if queries and not errors:
            spec["queries"] = queries
            return spec, queries

        if attempt == MAX_RETRIES:
            raise Exception(
                "The model could not produce a valid spec for this semantic model: "
                + "; ".join(errors[:6])
            )
        user_msg = (
            f"{user_msg}\n\nYour previous answer was rejected. Return the FULL corrected "
            "JSON, fixing these and keeping everything that was already valid:\n- "
            + "\n- ".join(errors[:12])
        )
    raise Exception("; ".join(errors[:6]))


def refine(db: Session, user: User, provider_row, model: str, current_spec: dict,
           queries: list, instruction: str, semantic_model=None,
           allowed_cubes: set | None = None) -> dict:
    """Edit the spec, not a page. Returns {spec, queries, usage}."""
    _require_scope(semantic_model, allowed_cubes)
    cube_context, members = cube_grounding(
        db, user.account.public_key, user.account_id, allowed_cubes
    )
    adapter = _adapter_for(provider_row)

    sample = fetch_data(db, user, queries, limit=SAMPLE_ROWS) if queries else {}
    system = REFINE_SYSTEM.format(
        samples=_samples_block(queries, sample),
        current_html=json.dumps(current_spec, indent=1, default=str),
    )
    # The design rules live in the brief prompt, so the editor is given them too.
    system += "\n\n## The rules that governed the original design\n" + PLAN_SYSTEM.format(
        semantic_model=(semantic_model.name if semantic_model is not None else "all models"),
        cube_context=cube_context,
        max_limit=MAX_LIMIT,
        default_limit=DEFAULT_QUERY_LIMIT,
    )

    spec, new_queries = _spec_turn(
        db, user, adapter, model, system, f"Change request:\n{instruction}", members
    )
    return {"spec": spec, "queries": new_queries, "usage": dict(adapter.total)}


_ASSETS = pathlib.Path(__file__).resolve().parent
RUNTIME_JS = (_ASSETS / "runtime.js").read_text()
RUNTIME_CSS = (_ASSETS / "runtime.css").read_text()


def render_page(spec: dict, theme: str, title: str = "Artifact") -> str:
    """Assemble the page from the spec using pre-built components.

    Deterministic: the same spec always produces the same page, so components
    always align. No rows are embedded — each component queries for its own,
    which is what keeps an artifact current when the data moves."""
    body = components.render_body(spec)
    config = components.spec_payload(spec)
    limits_json = json.dumps({
        "categories": int(os.getenv("ARTIFACT_MAX_CATEGORIES", "24")),
        "slices": int(os.getenv("ARTIFACT_MAX_SLICES", "12")),
    })
    theme_json = json.dumps(
        {"colors": PALETTE.get(theme, PALETTE["chester"]), "text": DEFAULT_TEXT_COLOR}
    ).replace("</", "<\\/")

    return (
        "<!doctype html>\n<html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{html_lib.escape(title)}</title>"
        f"<style>{RUNTIME_CSS}</style>"
        f"<script src='{html_lib.escape(CHART_LIB_URL, quote=True)}'></script>"
        f"<script>window.__CHESTER_SPEC__={config};"
        f"window.__CHESTER_THEME__={theme_json};"
        f"window.__CHESTER_LIMITS__={limits_json};</script>"
        f"</head><body>\n{body}\n"
        f"<script>{RUNTIME_JS}</script>\n</body></html>"
    )
