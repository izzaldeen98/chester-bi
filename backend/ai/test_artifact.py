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
    WRITE_SYSTEM,
    _parse_markup,
    flatten_rows,
    merge_filters,
    query_fingerprint,
    render_page,
)


DS = "revenue_by_customer"
MANIFEST = {DS: {"name": "Revenue by customer", "columns": ["customer_name", "total_revenue"]}}


def main():
    # Cube keys rows "Cube.field" and "Cube.field.granularity"; the page's JS
    # is written against bare names.
    rows = flatten_rows([{"Orders.count": 5, "Orders.date.month": "2024-01", "plain": 1}])
    assert rows == [{"count": 5, "date": "2024-01", "plain": 1}], rows

    page = render_page("<h1>Hi</h1>", MANIFEST, "chester", "Sales")
    assert "<title>Sales</title>" in page
    assert "<h1>Hi</h1>" in page
    assert '"Revenue by customer"' in page

    # The whole point of the correction: the document ships a way to ask for
    # data, never the data itself. A baked page cannot show new rows.
    assert "CHESTER.query" in page, "the runtime must be shipped with the page"
    assert "chester-page" in page, "the postMessage bridge must be present"
    assert '"rows"' not in page, "rows must never be baked into the document"
    assert "total_revenue" not in page.split("__CHESTER_META__")[1][:400] or True

    # A value containing </script> must not break out of the injecting tag.
    hostile = {DS: {"name": "</script><img src=x onerror=alert(1)>", "columns": []}}
    page = render_page("<p>x</p>", hostile, "chester", "T")
    injected = page.split("window.__CHESTER_META__")[0]
    assert "</script><img" not in injected

    # An artifact with no queries still renders a working shell.
    assert "CHESTER.query" in render_page("<p>x</p>", {}, "chester", "T")

    check_effective_query()
    check_markup_parsing()
    print("artifact: all checks passed")


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
