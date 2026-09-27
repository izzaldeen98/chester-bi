"""Run: python backend/ai/test_artifact.py

Covers the two pieces of artifact logic that can silently corrupt a page: the
Cube-key flattening the generated JS is written against, and the data injection
that puts untrusted values inside a <script> tag.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.artifact import (  # noqa: E402
    PLAN_SYSTEM,
    REFINE_SYSTEM,
    flatten_rows,
    merge_filters,
    query_fingerprint,
    render_page,
)
from ai.components import (  # noqa: E402
    filter_type_for,
    normalize_filters,
    pack_rows,
    validate_spec,
)


SPEC = {
    "title": "Revenue",
    "summary": "How revenue moved.",
    "filters": [{"id": "region", "label": "Region", "member": "customers.region", "type": "select"}],
    "components": [
        {"id": "k", "type": "kpi", "query": "totals", "value": "total_revenue",
         "label": "Revenue", "format": "currency", "size": "quarter"},
        {"id": "b", "type": "bar", "query": "by_cust", "x": "customer_name",
         "y": ["total_revenue"], "title": "By customer", "size": "half"},
        {"id": "t", "type": "text", "body": "Revenue grew 12%."},
    ],
}
QUERIES = [
    {"id": "totals", "label": "Totals", "cube_query": {"measures": ["l.total_revenue"]},
     "columns": ["total_revenue"]},
    {"id": "by_cust", "label": "By customer", "cube_query": {"measures": ["l.total_revenue"]},
     "columns": ["customer_name", "total_revenue"]},
]
MEMBERS = {"all": {"customers.region", "loads.date"}, "time_dimensions": {"loads.date"},
           "measures": set(), "dimensions": {"customers.region"}, "segments": set()}


def main():
    rows = flatten_rows([{"Orders.count": 5, "Orders.date.month": "2024-01", "plain": 1}])
    assert rows == [{"count": 5, "date": "2024-01", "plain": 1}], rows

    page = render_page(SPEC, "chester", "Sales")
    assert "<title>Sales</title>" in page
    assert 'data-cid="b"' in page and 'data-filter="region"' in page
    assert "Revenue grew 12%." in page

    # The page is assembled from shipped components, and holds no data.
    assert "__CHESTER_SPEC__" in page, "the runtime config must be present"
    assert "chester-page" in page, "the postMessage bridge must be present"
    assert '"rows"' not in page, "rows must never be embedded"

    # Text bodies and titles are escaped, not injected.
    hostile = dict(SPEC, title="</script><img src=x onerror=alert(1)>",
                   components=[{"id": "t", "type": "text", "body": "</style><script>bad()</script>"}])
    page = render_page(hostile, "chester", "T")
    assert "<img src=x" not in page and "bad()</script>" not in page

    check_number_formatting()
    check_granularity_reaches_the_page()
    check_cube_name_parsing()
    check_row_packing()
    check_scope_never_falls_open()
    check_agent_refuses_unscoped()
    check_model_isolation()
    check_spec_validation()
    check_model_edit_invalidates_cached_rows()
    check_effective_query()
    print("artifact: all checks passed")


def check_number_formatting():
    """Every number and date the page prints goes through the runtime's
    formatter. A warehouse measure arrives as a full float
    (205657.07999999996) and a time dimension as an ISO timestamp; neither
    may reach the page raw, on an axis, in a tooltip, a table cell or a KPI.

    Exercised against the shipped runtime.js so the assertions track the file
    the page actually loads."""
    import pathlib
    import re as _re
    import subprocess

    js = (pathlib.Path(__file__).resolve().parent / "runtime.js").read_text()
    body = js[js.index("var fmt = {"):js.index("var BASE = {")]
    probe = body + """
    var cases = [
      [format(205657.07999999996), "205,657"],
      [format(9136680.179999989, "currency"), "$9,136,680"],
      [format(36.241), "36"],
      [format(0.4567, "percent"), "45.7%"],
      [format(3896063.4599999, "decimal"), "3,896,063.46"],
      [format(0.333333), "0.33"],
      [format(null), "\u2014"],
      [format(""), "\u2014"],
      [format("text"), "text"],
      [label("ABC Corp"), "ABC Corp"],

      // A date reads at the granularity its query asked for. The value alone
      // cannot say: every one of these is the same instant.
      [label("2025-01-01T00:00:00.000", "year"), "2025"],
      [label("2025-01-01T00:00:00.000", "month"), "Jan 2025"],
      [label("2025-01-01T00:00:00.000", "day"), "Jan 1, 2025"],
      [label("2025-04-01T00:00:00.000", "quarter"), "Q2 2025"],

      // Inferring it from the value got both of these wrong: a daily point
      // landing on the 1st was labelled as a whole month, and an hourly one
      // at midnight lost its time entirely.
      [label("2025-03-01T00:00:00.000", "day"), "Mar 1, 2025"],
      [label("2025-01-01T00:00:00.000", "hour"), "Jan 1, 12:00 AM"],
      [label("2025-01-01T14:00:00.000", "hour"), "Jan 1, 02:00 PM"],

      // No granularity: show the whole value rather than guess a unit.
      [label("2025-01-01T00:00:00.000"), "Jan 1, 2025"],
      [label("2025-01-01T09:30:00.000"), "Jan 1, 09:30 AM"]
    ];
    var bad = cases.filter(function (c) { return c[0] !== c[1]; });
    console.log(bad.length ? "MISMATCH " + JSON.stringify(bad) : "ok");
    """
    out = subprocess.run(["node", "-e", probe], capture_output=True, text=True)
    assert out.returncode == 0, out.stderr[:400]
    assert out.stdout.strip() == "ok", out.stdout

    # No NUMBER path may fall through to a bare toLocaleString: it allows
    # three decimal places, which is how the raw floats got out. Date calls
    # legitimately carry no fraction digits, so they are excluded by shape —
    # either inline date options, or the GRAIN table, which is checked below
    # so it cannot be used to smuggle a number format past this.
    for hit in _re.findall(r"toLocaleString\(([^)]*)\)", js):
        is_date = "GRAIN" in hit or any(k in hit for k in ("month:", "day:", "hour:", "year:"))
        assert is_date or "FractionDigits" in hit, f"unbounded toLocaleString: {hit!r}"

    grain_table = js[js.index("var GRAIN = {"):js.index("function label(")]
    assert "FractionDigits" not in grain_table and "style:" not in grain_table, \
        "GRAIN must hold date options only"
    for unit in ("year", "month", "week", "day", "hour", "minute", "second"):
        assert f"{unit}:" in grain_table, f"GRAIN has no entry for {unit}"


def check_granularity_reaches_the_page():
    """The runtime can only format a date correctly if it is told which unit
    the query asked for, so the query's granularity must travel with the
    component into the page."""
    from ai.components import grain_for, spec_payload

    spec = {
        "queries": [
            {"id": "daily", "cube_query": {"timeDimensions": [
                {"dimension": "orders.created_at", "granularity": "day"}]}},
            {"id": "hourly", "cube_query": {"timeDimensions": [
                {"dimension": "orders.created_at", "granularity": "hour"}]}},
            {"id": "plain", "cube_query": {"measures": ["orders.count"]}},
        ],
        "components": [
            {"id": "a", "type": "line", "query": "daily", "x": "created_at", "y": ["count"]},
            {"id": "b", "type": "line", "query": "hourly", "x": "created_at", "y": ["count"]},
            {"id": "c", "type": "kpi", "query": "plain", "value": "count"},
        ],
    }

    assert grain_for(spec) == {"daily": {"created_at": "day"},
                               "hourly": {"created_at": "hour"}}, grain_for(spec)

    payload = json.loads(spec_payload(spec).replace("<\\/", "</"))
    by_id = {c["id"]: c for c in payload["components"]}
    assert by_id["a"]["grain"] == {"created_at": "day"}
    assert by_id["b"]["grain"] == {"created_at": "hour"}, "same column, different query, different unit"
    # A query with no time dimension carries nothing rather than an empty map.
    assert "grain" not in by_id["c"]

    # A query the spec does not describe must not crash the render.
    assert grain_for({"queries": [{"id": "x"}, "junk", {"id": "y", "cube_query": {}}]}) == {}


def check_cube_name_parsing():
    """Which cubes a model owns decides what its artifacts may touch, so this
    has to read any model an author might write — not only the shape this
    app's own wizard emits. The previous version required exactly two spaces
    of indentation, so a hand-written model resolved to no cubes at all and
    locked its artifacts out."""
    from utils.cube import extract_cube_names as ex

    assert ex("cubes:\n  - name: loads\n  - name: customers\n") == {"loads", "customers"}
    assert ex("cubes:\n    - name: orders\n") == {"orders"}, "deeper indentation"
    assert ex("cubes:\n- name: products\n") == {"products"}, "no indentation"
    assert ex('cubes:\n  - name: "trips"\n  - name: \'drivers\'\n') == {"trips", "drivers"}
    assert ex("cubes: [{name: facilities}]\n") == {"facilities"}, "flow style"
    assert ex("# note\ncubes:\n\n  # fact\n  - name: events\n") == {"events"}, "comments"
    assert ex("cubes:\n  - name: loads\nviews:\n  - name: rev\n") == {"loads", "rev"}
    assert ex("cube('web', {});\nview(\"summary\", {});") == {"web", "summary"}, "javascript"
    assert ex("") == set() and ex("   ") == set()

    # A nested `name:` belongs to a dimension, not a cube.
    assert ex("cubes:\n  - name: loads\n    dimensions:\n      - name: id\n") == {"loads"}

    # Unparseable input degrades to best effort rather than "no cubes",
    # which would lock every artifact on that model out of its own data.
    assert ex("cubes:\n  - name: half\n   bad: [unclosed\n")


def check_row_packing():
    """Every row fills exactly twelve columns. The model picks sizes by
    intent; leaving those spans as-is stranded a half-width chart alone on a
    row with half the page empty beside it."""
    def spans(sizes):
        return [s for _, s in pack_rows([{"size": x} for x in sizes])]

    assert spans(["half"]) == [12], "a lone component fills its row"
    assert spans(["half", "half"]) == [6, 6]
    assert spans(["third", "third", "third"]) == [4, 4, 4]
    assert spans(["quarter"] * 4) == [3, 3, 3, 3]
    assert sum(spans(["half", "third"])) == 12, "a ragged row is stretched"

    # Rows wrap at twelve and each is filled independently.
    r = spans(["half", "half", "half"])
    assert r[0] + r[1] == 12 and r[2] == 12, r
    assert spans([]) == []
    # An unknown size falls back to half rather than breaking the row maths.
    assert sum(spans(["enormous"])) == 12


def check_scope_never_falls_open():
    """`None` cube-names must mean "no model requested", never "this model
    resolved to nothing".

    Conflating the two silently disabled isolation: a model whose definitions
    were not written yet resolved to an empty set, which became None, which
    cube_grounding read as "no scope" — so the agent was shown every cube in
    the account instead of that model's none."""
    raw = {"cubes": [
        {"name": "loads", "measures": [{"name": "loads.total", "type": "number"}], "dimensions": []},
        {"name": "orders", "measures": [{"name": "orders.total", "type": "number"}], "dimensions": []},
    ]}
    from unittest.mock import patch
    from ai import grounding

    with patch.object(grounding, "meta_raw", lambda t: raw), \
         patch.object(grounding, "mint_token", lambda *a: "t"), \
         patch.object(grounding, "get_cached_query", lambda k: None), \
         patch.object(grounding, "cache_query", lambda k, v: True), \
         patch.object(grounding, "_definition_version", lambda k: "v"):
        # Scoped to one model: only that model's members.
        _, one = grounding.cube_grounding(None, "acct", 1, {"loads"})
        assert one["all"] == {"loads.total"}, one["all"]

        # An EMPTY scope must stay empty. If this ever returns both cubes,
        # an unresolvable model has been silently unscoped again.
        _, empty = grounding.cube_grounding(None, "acct", 1, set())
        assert empty["all"] == set(), (
            "an empty cube scope leaked the whole account: " + repr(empty["all"])
        )

        # Only an explicit None means "no model requested".
        _, everything = grounding.cube_grounding(None, "acct", 1, None)
        assert everything["all"] == {"loads.total", "orders.total"}


def check_agent_refuses_unscoped():
    """Isolation must not be losable by forgetting an argument."""
    from ai.artifact import _require_scope

    class M:
        name = "logistics"

    _require_scope(None, None)        # no model requested — fine
    _require_scope(M(), {"loads"})    # scoped — fine
    for missing in (None, set()):
        try:
            _require_scope(M(), missing)
            raise AssertionError(f"should have refused {missing!r}")
        except Exception as exc:
            assert "without its cube scope" in str(exc), exc


def check_model_isolation():
    """An artifact sees exactly one semantic model.

    Cube compiles every definition in an account into one namespace, so a
    member from a neighbouring model is a perfectly valid Cube reference and
    will execute unless the scope is enforced. This guards the filter path,
    which is the one that reaches Cube at runtime with user input."""
    from ai.validate import validate_runtime_filters

    mine = {
        "all": {"loads.total_revenue", "customers.customer_name"},
        "dimensions": {"customers.customer_name"},
        "measures": {"loads.total_revenue"},
        "time_dimensions": set(), "segments": set(),
    }
    own = [{"member": "customers.customer_name", "operator": "equals", "values": ["ABC"]}]
    assert validate_runtime_filters(own, mine) == []

    # A real member of a DIFFERENT model in the same account must not pass.
    foreign = [{"member": "customers2.age", "operator": "equals", "values": ["30"]}]
    errs = validate_runtime_filters(foreign, mine)
    assert errs and "does not exist in the semantic model" in errs[0], errs

    # Component validation is scoped by the same members dict.
    queries = [{"id": "q", "label": "Q", "cube_query": {}, "columns": ["customer_name"]}]
    spec = {"components": [{"id": "c", "type": "bar", "query": "q",
                            "x": "customer_name", "y": ["customer_name"]}],
            "filters": [{"id": "f", "label": "F", "member": "orders.payment_method",
                         "type": "select"}]}
    errs = validate_spec(spec, queries, mine)
    assert any("does not exist in the semantic model" in e for e in errs), errs


def check_spec_validation():
    """Everything the page does at runtime is decided here, so a valid spec
    cannot produce a chart bound to a column that does not exist."""
    assert validate_spec(SPEC, QUERIES, MEMBERS) == []

    def bad(**over):
        s = dict(SPEC); s.update(over); return validate_spec(s, QUERIES, MEMBERS)

    # A column the query does not return — the failure the old pages shipped.
    e = bad(components=[{"id": "b", "type": "bar", "query": "by_cust", "x": "nope", "y": ["total_revenue"]}])
    assert any("does not return" in x for x in e), e
    # An unknown query id.
    assert any("not one of the planned queries" in x
               for x in bad(components=[{"id": "b", "type": "bar", "query": "ghost", "x": "a", "y": ["b"]}]))
    # Unknown component type, missing required field, duplicate id, bad size.
    assert any("is unknown" in x for x in bad(components=[{"id": "x", "type": "sankey", "query": "totals"}]))
    assert any("required" in x for x in bad(components=[{"id": "k", "type": "kpi", "query": "totals"}]))
    assert any("duplicate" in x for x in bad(components=[SPEC["components"][0], SPEC["components"][0]]))
    assert any("size" in x for x in bad(components=[dict(SPEC["components"][1], size="enormous")]))

    # Filters: the member must exist. The control is no longer the model's to
    # pick, so a wrong one is impossible rather than an error it has to fix.
    assert any("does not exist" in x for x in
               bad(filters=[{"id": "f", "label": "F", "member": "nope.x"}]))
    assert any("needs an id and a label" in x for x in
               bad(filters=[{"id": "f", "member": "customers.region"}]))

    # The control follows from the member: a time dimension gets a range,
    # everything else a multi-select — whatever the model asked for.
    assert filter_type_for("loads.date", MEMBERS) == "date_range"
    assert filter_type_for("customers.region", MEMBERS) == "multiselect"

    s = {"components": SPEC["components"],
         "filters": [{"id": "a", "label": "A", "member": "customers.region", "type": "date_range"},
                     {"id": "b", "label": "B", "member": "loads.date", "type": "search"}]}
    assert validate_spec(s, QUERIES, MEMBERS) == []
    assert [f["type"] for f in s["filters"]] == ["multiselect", "date_range"], \
        "validation must overwrite whatever control the model asked for"

    # normalize_filters does the same before validation, for the retry turn.
    s2 = {"filters": [{"id": "a", "label": "A", "member": "loads.date", "type": "slider"}]}
    normalize_filters(s2, MEMBERS)
    assert s2["filters"][0]["type"] == "date_range"

    # A spec saved before the controls were narrowed still renders, and every
    # non-date filter comes out as a dropdown rather than a native list box.
    page = render_page({"title": "T", "components": SPEC["components"],
                        "filters": s["filters"]}, "chester", "T")
    bar = page[page.index('<div class="cb-filters"'):page.index("data-clear-all")]
    assert "<select" not in bar, "no native select should survive in the filter bar"
    assert bar.count("cb-ms-toggle") == 1 and bar.count('type="date"') == 2


def check_model_edit_invalidates_cached_rows():
    """Fixing a semantic model must change what artifacts serve.

    The Cube query text is identical before and after a model is corrected —
    a date cast, a measure's SQL — so a cache keyed on the query alone went on
    serving the old rows and the fix looked like it had not worked."""
    import tempfile
    from ai import artifact as art

    query = {"measures": ["sales.count"], "limit": 10}
    original = art._definition_version
    try:
        art._definition_version = lambda _key: "version-one"
        before = art.query_fingerprint("acct", query)
        art._definition_version = lambda _key: "version-two"
        after = art.query_fingerprint("acct", query)
    finally:
        art._definition_version = original

    assert before != after, "a model edit must not reuse the old cache entry"
    # Still stable for an unchanged model, or nothing would ever be cached.
    try:
        art._definition_version = lambda _key: "version-one"
        assert art.query_fingerprint("acct", query) == before
        assert art.query_fingerprint("other-acct", query) != before, "accounts must not share"
        assert art.query_fingerprint("acct", {"measures": ["sales.count"], "limit": 11}) != before
    finally:
        art._definition_version = original

    # The real version function changes when a definition file changes.
    from utils import cube as cube_utils
    with tempfile.TemporaryDirectory() as tmp:
        root = cube_utils.DEFINITION_ROOT
        try:
            cube_utils.DEFINITION_ROOT = tmp
            import os
            os.makedirs(os.path.join(tmp, "acct", "definitions"), exist_ok=True)
            path = os.path.join(tmp, "acct", "definitions", "m.yml")
            open(path, "w").write("cubes:\n  - name: a\n")
            first = cube_utils._definition_version("acct")
            open(path, "w").write("cubes:\n  - name: a\n  - name: b\n")
            os.utime(path, (0, 12345))
            assert cube_utils._definition_version("acct") != first
        finally:
            cube_utils.DEFINITION_ROOT = root


def check_effective_query():
    """Cross-filtering is a merge over the stored query, and the cache key is
    what decides which components actually re-fetch."""
    base = {"measures": ["loads.total_revenue"], "limit": 500}
    f = [{"member": "customers.region", "operator": "equals", "values": ["EU"]}]

    merged = merge_filters(base, f)
    assert merged["filters"] == f
    assert "filters" not in base, "the stored query must never be mutated"
    assert merged["measures"] == base["measures"]

    # Filters append rather than replace, so a component's own filters survive.
    own = {"measures": ["m"], "filters": [{"member": "a.b", "operator": "set"}]}
    assert len(merge_filters(own, f)["filters"]) == 2

    # No filters is the identity case.
    assert merge_filters(base, None) == base
    assert merge_filters(base, []) == base

    # The fingerprint decides cache hits: stable for the same query, different
    # once a filter lands, and not shared across accounts.
    assert query_fingerprint("acct", base) == query_fingerprint("acct", dict(base))
    assert query_fingerprint("acct", base) != query_fingerprint("acct", merged)
    assert query_fingerprint("acct", base) != query_fingerprint("other", base)
    # Key order must not change the hash, or every render would miss.
    assert query_fingerprint("acct", {"a": 1, "b": 2}) == query_fingerprint("acct", {"b": 2, "a": 1})


def check_markup_parsing():
    """write/refine answer with raw HTML, not JSON — a 20KB document escaped into
    a JSON string dies on one stray backslash ("Invalid \\escape"), which threw
    away a whole generated page."""
    assert _parse_markup("<h1>a</h1>") == "<h1>a</h1>"
    assert _parse_markup("```html\n<h1>a</h1>\n```") == "<h1>a</h1>"
    assert _parse_markup("```\n<h1>a</h1>\n```") == "<h1>a</h1>"
    # A full document gets unwrapped: the host supplies <!doctype>/<head>.
    assert _parse_markup(
        "<!doctype html><html><head><title>t</title></head><body><h1>a</h1></body></html>"
    ) == "<h1>a</h1>"
    assert _parse_markup("<!DOCTYPE html>\n<div>x</div>") == "<div>x</div>"
    # The exact content that broke JSON parsing must survive untouched.
    assert "\\d" in _parse_markup(r'<script>x.replace(/\d/g,"")</script>')
    try:
        _parse_markup("Sure! Here is your page:")
        raise AssertionError("prose should be rejected")
    except Exception as exc:
        assert "did not return HTML" in str(exc)


if __name__ == "__main__":
    main()
