#!/usr/bin/env python3
"""Regenerates visual_component_spec.md from the frontend's ChartsSchemas.ts +
FiltersSchema.ts, so the LLM grounding can never drift from what the renderer
actually accepts. Re-run after editing either schema file:

    python backend/grounding/gen_component_spec.py

ponytail: regex over declarative object literals, not a TS parser. It relies on
ChartsSchemas.ts keeping one `name: "..."` per field and `value: "..."` inside
options — if that style changes, this breaks loudly (empty field lists), not
silently.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHARTS = ROOT / "frontend/src/components/charts/ChartsSchemas.ts"
FILTERS = ROOT / "frontend/src/components/filters/FiltersSchema.ts"
DATEFMT = ROOT / "frontend/src/lib/dateTimeFormat.ts"
OUT = Path(__file__).parent / "visual_component_spec.md"
OUT_JSON = Path(__file__).parent / "visual_component_spec.json"

# Chart config values the renderer reads as comma-joined lists, not scalars.
LIST_INPUTS = {"multi-select", "multi-color", "multi-text"}

# WidgetEditDialog.tsx fills an option-less `select` named "*format*" from its
# own FORMAT_OPTIONS constant rather than from the schema — mirror that here or
# the LLM reads those fields as dataset field names.
FORMAT_OPTIONS = ["currency", "percentage", "number", "decimal"]


def _values(block: str) -> list[str]:
    return re.findall(r'value\s*:\s*"([^"]+)"', block)


def date_format_options() -> list[str]:
    block = re.search(r"DATE_TIME_FORMAT_OPTIONS\s*=\s*\[(.*?)\];", DATEFMT.read_text(), re.S)
    return _values(block.group(1)) if block else []


def parse_charts() -> list[dict]:
    text = CHARTS.read_text()
    date_opts = date_format_options()
    charts = []
    # Each `export const XSchema = { chartType: "x", fields: [...] }` block runs
    # until the next `export const` (or EOF).
    for m in re.finditer(r"export const \w+\s*=\s*\{(.*?)(?=\nexport const |\Z)", text, re.S):
        block = m.group(1)
        ct = re.search(r'chartType\s*:\s*"([^"]+)"', block)
        if not ct:
            continue
        # Slice the block at each field's `name:` so per-field keys stay scoped.
        starts = [f.start() for f in re.finditer(r'\bname\s*:\s*"[^"]+"', block)]
        fields = []
        for i, start in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else len(block)
            fb = block[start:end]
            name = re.search(r'name\s*:\s*"([^"]+)"', fb).group(1)
            input_type = (re.search(r'inputType\s*:\s*"([^"]+)"', fb) or [None, ""])[1] \
                if re.search(r'inputType\s*:\s*"([^"]+)"', fb) else ""
            opts = _values(fb)
            if "DATE_TIME_FORMAT_OPTIONS" in fb:
                opts = date_opts
            fields.append({
                "name": name,
                "input": input_type,
                "required": "required : true" in fb.replace(":", " : ") or bool(re.search(r"required\s*:\s*true", fb)),
                "options": opts,
                "default": (re.search(r'defaultValue\s*:\s*"([^"]+)"', fb) or [None, None])[1]
                if re.search(r'defaultValue\s*:\s*"([^"]+)"', fb) else None,
                "only_when": (re.search(r'showWhen\s*:\s*"([^"]+)"', fb) or [None, None])[1]
                if re.search(r'showWhen\s*:\s*"([^"]+)"', fb) else None,
            })
        for f in fields:
            f["kind"], f["enum"] = classify(f)
        charts.append({"type": ct.group(1), "fields": fields})
    return charts


def parse_filters() -> list[dict]:
    text = FILTERS.read_text()
    kinds = []
    for m in re.finditer(r"export const (\w+)\s*=\s*\{(.*?)\n\};", text, re.S):
        body = m.group(2)
        kind = re.search(r'kind\s*:\s*"([^"]+)"', body)
        if not kind:
            continue
        ops = _values(body)
        if not ops and "DateTimeFilterSchema.operators" in body:
            ops = None  # alias — resolved below
        kinds.append({"kind": kind.group(1), "operators": ops})
    datetime_ops = next((k["operators"] for k in kinds if k["kind"] == "datetime"), [])
    for k in kinds:
        if k["operators"] is None:
            k["operators"] = datetime_ops
    return kinds


def classify(field: dict) -> tuple[str, list[str]]:
    """(kind, enum values) — what the validator must check this key's value
    against. "field"/"fields" mean the value names dataset column(s)."""
    inp, name = field["input"], field["name"].lower()
    if field["options"]:
        return "enum", field["options"]
    if inp == "select" and "format" in name:
        return "enum", FORMAT_OPTIONS
    if inp == "select":
        return "field", []
    if inp == "multi-select":
        return "fields", []
    if inp == "color":
        return "color", []
    if inp == "multi-color":
        return "colors", []
    if inp == "switch":
        return "bool", []
    if inp == "number":
        return "number", []
    return "text", []


def describe(field: dict) -> str:
    kind, enum = field["kind"], field["enum"]
    bits = []
    if field["input"] in LIST_INPUTS:
        bits.append("comma-joined list")
    if kind == "enum":
        bits.append("one of: " + ", ".join(f'"{o}"' for o in enum))
    elif kind == "field":
        bits.append("dataset field name")
    elif kind == "fields":
        bits.append("dataset field names")
    elif kind == "color":
        bits.append("hex color")
    elif kind == "colors":
        bits.append("hex colors, one per series")
    elif kind == "bool":
        bits.append('"true" or "false"')
    elif kind == "number":
        bits.append("number as a string")
    if field["default"] is not None:
        bits.append(f'default "{field["default"]}"')
    if field["only_when"]:
        bits.append(f'only when {field["only_when"]}="true"')
    return "; ".join(bits) or "free text"


def main() -> None:
    charts = parse_charts()
    assert charts and all(c["fields"] for c in charts), "parse failed — ChartsSchemas.ts style changed"
    lines = [
        "# Visual component specification",
        "",
        "GENERATED by backend/grounding/gen_component_spec.py — do not edit by hand.",
        "Source of truth: frontend/src/components/charts/ChartsSchemas.ts.",
        "",
        "Every value inside `chartConfig` is a STRING, including numbers and booleans.",
        "Fields marked REQUIRED must be present. Keys not listed here are rejected.",
        "",
    ]
    for c in charts:
        lines.append(f'## chartType: "{c["type"]}"')
        lines.append("")
        for f in c["fields"]:
            req = " **REQUIRED**" if f["required"] else ""
            lines.append(f'- `{f["name"]}`{req} — {describe(f)}')
        lines.append("")

    lines += ["# Filter specification", "",
              "A filter element's `meta.filterRule.operator` must be copied verbatim from",
              "its kind's list. `between`, `not between`, `last` and `next` take a",
              "comma-joined `value` string (e.g. `2024-01-01 00:00:00,2024-12-31 00:00:00`).",
              ""]
    for k in parse_filters():
        lines.append(f'## kind: "{k["kind"]}"')
        lines.append("")
        lines.append("- operators: " + ", ".join(f'`{o}`' for o in k["operators"]))
        lines.append("")

    OUT.write_text("\n".join(lines))
    # Machine-readable twin the validator reads (ai/validate.py) — keeps the
    # backend from having to parse TypeScript, or exist next to the frontend
    # source at all, in a container.
    OUT_JSON.write_text(json.dumps({"charts": charts, "filters": parse_filters()}, indent=1))
    print(f"wrote {OUT} + {OUT_JSON} ({len(charts)} chart types)")


if __name__ == "__main__":
    main()
