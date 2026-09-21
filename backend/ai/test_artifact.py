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
    render_page,
)


DS = "revenue_by_customer"
LABELS = {DS: "Revenue by customer"}


def main():
    # Cube keys rows "Cube.field" and "Cube.field.granularity"; the page's JS is
    # written against bare names.
    rows = flatten_rows([{"Orders.count": 5, "Orders.date.month": "2024-01", "plain": 1}])
    assert rows == [{"count": 5, "date": "2024-01", "plain": 1}], rows

    page = render_page("<h1>Hi</h1>", {DS: rows}, LABELS, "chester", "Sales")
    assert "<title>Sales</title>" in page
    assert "<h1>Hi</h1>" in page
    assert "window.CHESTER=" in page
    assert '"columns": ["count", "date", "plain"]' in page
    assert '"name": "Revenue by customer"' in page

    # A data value containing </script> must not break out of the injecting tag.
    hostile = [{"note": "</script><img src=x onerror=alert(1)>"}]
    page = render_page("<p>x</p>", {DS: hostile}, LABELS, "chester", "T")
    injected = page.split("window.CHESTER=")[1].split(";</script>")[0]
    assert "</script>" not in injected, injected
    assert "<\\/script>" in injected

    # An empty dataset must still render (the page guards, but so must we).
    page = render_page("<p>x</p>", {DS: []}, LABELS, "chester", "T")
    assert '"columns": []' in page

    # The prompts use .format() with literal JS/JSON braces — make sure they render.
    planned = PLAN_SYSTEM.format(semantic_model="m", cube_context="c", max_limit=5000)
    assert "queries" in planned and '"cube_query"' in planned
    written = WRITE_SYSTEM.format(plan="p", samples="s", palette="#fff", text_color="#111")
    assert "window.CHESTER = {" in written and "raw HTML and nothing else" in written
    assert "COMPLETE markup" in REFINE_SYSTEM.format(samples="s", current_html="h")

    check_markup_parsing()
    print("artifact: all checks passed")


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
