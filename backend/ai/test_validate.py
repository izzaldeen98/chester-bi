"""Run: python backend/ai/test_validate.py  (no framework, no fixtures)

Guards the one piece of real logic in this feature: what the agent is allowed to
save. Every case here is a mistake an LLM actually makes.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.validate import validate_element, validate_elements  # noqa: E402

DS = "11111111-2222-3333-4444-555555555555"
CTX = {
    "datasets_by_id": {DS: {"name": "Orders", "fields": {"total_orders", "revenue", "order_date", "region"}}},
    "meta_fields": {"orders.date", "orders.region"},
    "definition_ids": {"99999999-8888-7777-6666-555555555555"},
    "grid_rows": 36,
}


def card(**config):
    return {
        "id": "widget-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "layout": {"x": 0, "y": 0, "w": 8, "h": 3},
        "meta": {"title": "T", "datasetId": DS, "chartType": "card",
                 "chartConfig": {"value": "total_orders", **config}},
    }


def errs(el):
    return validate_element(el, CTX)


def main():
    assert errs(card()) == [], errs(card())

    # Numbers and booleans must be strings — the renderer reads strings only.
    assert any("must be a string" in e for e in errs(card(titleFontSize=14)))
    assert any("must be a string" in e for e in errs(card(hasTarget=False)))
    assert any('"true" or "false"' in e for e in errs(card(hasTarget="yes")))

    # Hallucinated field names and config keys.
    assert any("not a field of dataset" in e for e in errs(card(compareField="profit", hasCompare="true")))
    assert any("not valid for chartType" in e for e in errs(card(sparkline="true")))
    assert any("must be one of" in e for e in errs(card(valueFormat="money")))
    assert any("must be a hex color" in e for e in errs(card(titleFontColor="red")))

    # Missing required key.
    bad = card()
    del bad["meta"]["chartConfig"]["value"]
    assert any("is required" in e for e in errs(bad))

    # Unknown dataset / chart type.
    unknown_ds = card()
    unknown_ds["meta"]["datasetId"] = "00000000-0000-0000-0000-000000000000"
    assert any("not one of the available datasets" in e for e in errs(unknown_ds))
    unknown_type = card()
    unknown_type["meta"]["chartType"] = "sankey"
    assert any("is unknown" in e for e in errs(unknown_type))

    # Grid overflow — 32 columns.
    wide = card()
    wide["layout"] = {"x": 28, "y": 0, "w": 8, "h": 3}
    assert any("must be <= 32" in e for e in errs(wide))
    tall = card()
    tall["layout"] = {"x": 0, "y": 34, "w": 8, "h": 8}
    assert any("gridRows" in e for e in errs(tall))

    # Comma-joined list fields are checked per member.
    line = {
        "id": "widget-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef",
        "layout": {"x": 0, "y": 0, "w": 16, "h": 8},
        "meta": {"title": "Trend", "datasetId": DS, "chartType": "line",
                 "chartConfig": {"xAxis": "order_date", "yAxis": "revenue,total_orders",
                                 "yAxisColor": "#eab308,#3b82f6"}},
    }
    assert errs(line) == [], errs(line)
    line["meta"]["chartConfig"]["yAxis"] = "revenue,margin"
    assert any("references 'margin'" in e for e in errs(line))
    line["meta"]["chartConfig"]["yAxis"] = "revenue"
    line["meta"]["chartConfig"]["yAxisColor"] = "#eab308,teal"
    assert any("not a hex color" in e for e in errs(line))

    # Filters: operator must belong to the kind, mapping must exist in Cube meta.
    filt = {
        "id": "filter-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "layout": {"x": 0, "y": 0, "w": 10, "h": 2},
        "meta": {"title": "Date", "filterRule": {
            "label": "Date", "kind": "datetime", "operator": "between",
            "value": "2024-01-01 00:00:00,2024-12-31 00:00:00",
            "mappings": [{"definitionId": "99999999-8888-7777-6666-555555555555",
                          "sourceName": "orders", "fieldName": "date"}],
            "targetWidgetIds": []}},
    }
    assert errs(filt) == [], errs(filt)
    filt["meta"]["filterRule"]["operator"] = "contains"       # a text operator
    assert any("not valid for kind" in e for e in errs(filt))
    filt["meta"]["filterRule"]["operator"] = "between"
    filt["meta"]["filterRule"]["mappings"][0]["fieldName"] = "shipped_at"
    assert any("does not exist in the semantic model" in e for e in errs(filt))

    # Bad ids.
    stray = card()
    stray["id"] = "chart-1"
    assert errs(stray)

    # The batch splitter keeps the good and reports the bad.
    good, problems = validate_elements([card(), unknown_type], CTX)
    assert len(good) == 1 and problems

    print("validate.py: all checks passed")


if __name__ == "__main__":
    main()
