"""Run: python backend/ai/test_cube_query.py

Artifacts let the agent write its own Cube queries against the semantic model.
This is the gate: anything wrong here either reaches Cube malformed or produces
a page whose charts read empty arrays. Every case is a mistake an LLM makes.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.validate import MAX_LIMIT, validate_cube_query, validate_queries  # noqa: E402

MEMBERS = {
    "measures": {"orders.count", "orders.revenue"},
    "dimensions": {"orders.region", "orders.date", "customers.name"},
    "time_dimensions": {"orders.date"},
    "segments": {"orders.completed"},
}
MEMBERS["all"] = MEMBERS["measures"] | MEMBERS["dimensions"] | MEMBERS["segments"]


def errs(query):
    return validate_cube_query(query, MEMBERS, "q")


def main():
    assert errs({"measures": ["orders.count"]}) == []
    assert errs({
        "measures": ["orders.revenue"],
        "dimensions": ["orders.region"],
        "timeDimensions": [{"dimension": "orders.date", "granularity": "month",
                            "dateRange": "last 12 months"}],
        "filters": [{"member": "orders.region", "operator": "equals", "values": ["EU"]}],
        "order": {"orders.revenue": "desc"},
        "limit": 500,
    }) == [], errs({"measures": ["orders.revenue"]})

    # Hallucinated members, and measures/dimensions swapped — the classic mistake.
    assert any("unknown" in e for e in errs({"measures": ["orders.profit"]}))
    assert any("a dimension, not a measure" in e for e in errs({"measures": ["orders.region"]}))
    assert any("a measure, not a dimension" in e for e in errs({"dimensions": ["orders.count"]}))
    assert errs({}) and errs({"measures": [], "dimensions": []})

    # Time dimensions.
    bad_td = {"measures": ["orders.count"], "timeDimensions": [{"dimension": "orders.region"}]}
    assert any("not a time dimension" in e for e in errs(bad_td))
    bad_gran = {"measures": ["orders.count"],
                "timeDimensions": [{"dimension": "orders.date", "granularity": "fortnight"}]}
    assert any("granularity" in e for e in errs(bad_gran))

    # Filters: unknown member, invented operator, missing/!string values.
    def f(**kw):
        return {"measures": ["orders.count"], "filters": [kw]}
    assert any("does not exist" in e for e in errs(f(member="orders.nope", operator="equals", values=["x"])))
    assert any("not a Cube operator" in e for e in errs(f(member="orders.region", operator="like", values=["x"])))
    assert any("non-empty" in e for e in errs(f(member="orders.region", operator="equals")))
    assert any("must be strings" in e for e in errs(f(member="orders.count", operator="gt", values=[5])))
    # set/notSet legitimately take no values.
    assert errs(f(member="orders.region", operator="set")) == []
    # Cube's boolean grouping is allowed, and validated inside.
    assert errs({"measures": ["orders.count"], "filters": [
        {"or": [{"member": "orders.region", "operator": "equals", "values": ["EU"]},
                {"member": "orders.region", "operator": "equals", "values": ["US"]}]}]}) == []
    assert any("does not exist" in e for e in errs({"measures": ["orders.count"], "filters": [
        {"and": [{"member": "nope", "operator": "set"}]}]}))

    # order must reference something the query selects.
    assert any("does not select" in e for e in
               errs({"measures": ["orders.count"], "order": {"orders.revenue": "desc"}}))
    assert any("'asc' or 'desc'" in e for e in
               errs({"measures": ["orders.count"], "order": {"orders.count": "descending"}}))
    # Array form is valid Cube too.
    assert errs({"measures": ["orders.count"], "order": [["orders.count", "desc"]]}) == []

    # The limit cap keeps a query from becoming a multi-megabyte page.
    assert any("between 1 and" in e for e in errs({"measures": ["orders.count"], "limit": MAX_LIMIT + 1}))
    assert any("between 1 and" in e for e in errs({"measures": ["orders.count"], "limit": 0}))
    assert errs({"measures": ["orders.count"], "limit": MAX_LIMIT}) == []

    # Invented top-level keys (models love "aggregations" / "groupBy").
    assert any("not a Cube query key" in e for e in errs({"measures": ["orders.count"], "groupBy": ["x"]}))
    assert any("segment" in e for e in errs({"measures": ["orders.count"], "segments": ["orders.nope"]}))

    # ── The query set ──────────────────────────────────────────────────────
    ok = {"id": "revenue_by_region", "label": "Revenue by region",
          "cube_query": {"measures": ["orders.revenue"], "dimensions": ["orders.region"]}}
    good, problems = validate_queries([ok], MEMBERS)
    assert len(good) == 1 and not problems
    assert good[0]["label"] == "Revenue by region"

    # A bad id is rejected — the page keys its data off it.
    bad_id, problems = validate_queries([{**ok, "id": "Revenue By Region"}], MEMBERS)
    assert not bad_id and any("lower_snake_case" in p for p in problems)
    # Duplicate ids would silently overwrite each other's rows.
    dupes, problems = validate_queries([ok, ok], MEMBERS)
    assert len(dupes) == 1 and any("duplicate" in p for p in problems)
    # Label defaults to the id.
    unlabelled, _ = validate_queries([{"id": "x_y", "cube_query": {"measures": ["orders.count"]}}], MEMBERS)
    assert unlabelled[0]["label"] == "x_y"
    # The valid ones survive alongside the invalid.
    mixed, problems = validate_queries(
        [ok, {"id": "broken", "cube_query": {"measures": ["orders.nope"]}}], MEMBERS)
    assert len(mixed) == 1 and problems
    assert validate_queries([], MEMBERS) == ([], ["The model returned no queries."])

    print("cube_query: all checks passed")


if __name__ == "__main__":
    main()
