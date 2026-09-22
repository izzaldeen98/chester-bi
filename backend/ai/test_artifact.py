"""Run: python backend/ai/test_artifact.py

Covers the two pieces of artifact logic that can silently corrupt a page: the
Cube-key flattening the generated JS is written against, and the data injection
that puts untrusted values inside a <script> tag.
"""
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
from ai.components import pack_rows, validate_spec  # noqa: E402


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

    check_cube_name_parsing()
    check_row_packing()
    check_model_isolation()
    check_spec_validation()
    check_effective_query()
    print("artifact: all checks passed")


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

    # Filters: the member must exist, and a date_range needs a time dimension.
    assert any("does not exist" in x for x in
               bad(filters=[{"id": "f", "label": "F", "member": "nope.x", "type": "select"}]))
    assert any("not a time dimension" in x for x in
               bad(filters=[{"id": "f", "label": "F", "member": "customers.region", "type": "date_range"}]))
    assert bad(filters=[{"id": "f", "label": "F", "member": "loads.date", "type": "date_range"}]) == []
    assert any("must be one of" in x for x in
               bad(filters=[{"id": "f", "label": "F", "member": "customers.region", "type": "slider"}]))


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
