"""Dashboard generation + per-component editing.

The agent never writes SQL and never writes a Cube query: Chester BI's charts
bind to a saved Dataset (meta.datasetId) and the existing frontend runtime runs
that dataset's cube_query live, merging dashboard filters client-side. So the
agent's whole job is producing the same dashboard config JSON the drag-and-drop
workspace already saves — which is why there is no HTML renderer here.

Bounded: MAX_RETRIES validation round-trips, then whatever is still invalid is
dropped and reported to the caller.
"""
import json
import re

from sqlalchemy.orm import Session

from ai.adapters import get_adapter
from ai.grounding import (
    DEFAULT_TEXT_COLOR,
    PALETTE,
    account_datasets,
    component_spec,
    cube_grounding,
    dataset_block,
    dataset_fields,
)
from ai.validate import GRID_COLS, validate_element, validate_elements
from models.user import User
from security import decrypt_password

MAX_RETRIES = 2
DEFAULT_GRID_ROWS = 36  # matches DEFAULT_GRID_ROWS in DashboardWorkSpace.tsx

GENERATE_SYSTEM = """\
You are a dashboard composer for Chester BI, a BI tool backed by the Cube semantic layer.
You turn a user's plain-language brief into a dashboard configuration file.

You output JSON only. No prose, no explanation, no markdown code fence.

## What you may use

You do NOT write SQL and you do NOT write Cube queries. Every chart reads from a saved
Dataset. You may only reference the datasets listed below. If the user asks for something
no dataset covers, omit that chart and name it in the "unmet" array.

You are working against ONE semantic model: **{semantic_model}**. Everything below —
datasets, cubes, measures, dimensions — belongs to it. Nothing outside it exists for
this dashboard.

### Available datasets (one JSON object per line)
{datasets}

### Semantic model (live Cube /meta) — what the data means
{cube_context}

### Component and filter specification
{spec}

## Output format

{{"name": "...", "description": "...", "gridRows": <int>, "elements": [...], "unmet": ["..."]}}

A widget element:
{{"id": "widget-<uuid4>",
  "layout": {{"x": 0, "y": 0, "w": 8, "h": 3, "minW": 2, "minH": 2}},
  "meta": {{"title": "...", "query": "<dataset name>", "datasetId": "<datasetId>",
           "chartType": "card|line|bar|scatter|pie|table|waterfall|treemap",
           "chartConfig": {{...}}}}}}

A filter element:
{{"id": "filter-<uuid4>",
  "layout": {{"x": 0, "y": 0, "w": 10, "h": 2, "minW": 4, "minH": 1}},
  "meta": {{"title": "...",
           "filterRule": {{"label": "...", "kind": "datetime|date|number|text",
             "operator": "...", "value": "...",
             "mappings": [{{"definitionId": "...", "definitionName": "...",
                           "modelId": "...", "modelName": "...",
                           "sourceName": "<cube>", "fieldName": "<field>"}}],
             "targetWidgetIds": [], "uiType": "slicer"}}}}}}

## Hard rules

1. Widget ids are "widget-" + a fresh uuid4; filter ids are "filter-" + a fresh uuid4.
   Never reuse an id.
2. EVERY value inside chartConfig is a STRING. Write "14", not 14. Write "false", not
   false. The renderer reads strings; a real number or boolean fails validation.
3. Only use chartConfig keys the specification lists for that chartType. An unknown key
   is rejected and the chart is dropped.
4. Every field name in chartConfig must appear in that dataset's measures/dimensions,
   spelled exactly.
5. The grid is {grid_cols} columns wide. x + w must be <= {grid_cols}, and y + h must be
   <= gridRows. Do not overlap elements. Filters at y=0, then KPI cards, then charts,
   then tables.
6. Filter operators are copied verbatim from the filter specification for that kind.
   "between", "not between", "last" and "next" take a comma-joined value string, e.g.
   "2024-01-01 00:00:00,2024-12-31 00:00:00".
7. Filter mappings must name a real definitionId from the dataset list and a
   sourceName.fieldName that exists in the semantic model.
8. Use only these colors: {palette}. Text/title colors: "{text_color}". Set colors on
   every chart so the dashboard reads as one design, not eight.
9. Titles and labels are plain text. No HTML, no markdown, no scripts.

## Judgment

Lead with 3-5 KPI cards answering the headline question, then trend over time, then a
breakdown by dimension, then a detail table. Prefer fewer, better charts. A chart that
restates the card above it is noise — cut it.\
"""

EDIT_SYSTEM = """\
You are editing ONE component of an existing Chester BI dashboard.

You output a single JSON object — the updated element — and nothing else. No prose, no
markdown fence, no wrapper object.

### The element as it stands
{element}

### The dataset it currently reads
{current_dataset}

### All available datasets (if the change needs a different one)
{datasets}

### Semantic model (live Cube /meta)
{cube_context}

### Component and filter specification
{spec}

## Hard rules

1. Keep "id" EXACTLY as given. Changing it orphans the component.
2. Change only what the request asks for. Every other field keeps its current value
   verbatim, layout included, unless resizing was asked for.
3. If you change chartType, rebuild chartConfig from scratch for the new type — the old
   type's keys are invalid on the new one. Carry over the title and colors.
4. EVERY chartConfig value is a STRING. "14", not 14. "false", not false.
5. Field names must exist in the referenced dataset, spelled exactly.
6. The grid is {grid_cols} columns wide: x + w must be <= {grid_cols}.
7. Use only these colors: {palette}.
8. If the request cannot be satisfied with the available datasets and component types,
   return the element UNCHANGED with an added "_error" key holding one sentence saying
   what is missing.\
"""


def _parse_json(text: str) -> dict:
    """LLMs fence JSON even when told not to. Strip a fence, else take the
    outermost braces."""
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


def build_context(db: Session, user: User, semantic_model_id=None,
                  allowed_cubes: set | None = None) -> dict:
    """Everything both the prompts and the validator need, fetched once, scoped
    to the semantic model the user picked (see routes/ai.py::_model_scope)."""
    datasets = account_datasets(db, user.account_id, semantic_model_id)
    cube_context, members = cube_grounding(
        db, user.account.public_key, user.account_id, allowed_cubes
    )
    return {
        "datasets": datasets,
        "datasets_text": dataset_block(datasets),
        "datasets_by_id": {
            str(d.public_key): {"name": d.name, "fields": dataset_fields(d)} for d in datasets
        },
        "definition_ids": {str(d.definition.public_key) for d in datasets},
        # Dashboard filter mappings only need "does this member exist at all".
        "meta_fields": members["all"],
        "cube_context": cube_context,
        "spec": component_spec(),
        "grid_rows": DEFAULT_GRID_ROWS,
    }


def _adapter_for(provider_row):
    return get_adapter(
        provider_row.provider, decrypt_password(provider_row.api_key_enc), provider_row.base_url
    )


def _palette(theme: str) -> list[str]:
    return PALETTE.get(theme, PALETTE["chester"])


def generate(db: Session, user: User, provider_row, model: str, brief: str, theme: str,
             semantic_model=None, allowed_cubes: set | None = None) -> dict:
    """Returns {name, description, gridRows, elements, unmet, errors}. `errors`
    lists components dropped after MAX_RETRIES — the rest are valid and saveable.

    `semantic_model` is the Chester BI Model row the user picked: the agent reads
    only that model's cubes and only datasets built on it."""
    model_key = semantic_model.public_key if semantic_model is not None else None
    ctx = build_context(db, user, model_key, allowed_cubes)
    if not ctx["datasets"]:
        where = f'the semantic model "{semantic_model.name}"' if semantic_model is not None else "this account"
        raise Exception(f"No saved datasets exist for {where} — build a dataset on it first.")

    system = GENERATE_SYSTEM.format(
        semantic_model=(semantic_model.name if semantic_model is not None else "all models in this account"),
        datasets=ctx["datasets_text"],
        cube_context=ctx["cube_context"],
        spec=ctx["spec"],
        grid_cols=GRID_COLS,
        palette=", ".join(_palette(theme)),
        text_color=DEFAULT_TEXT_COLOR,
    )
    adapter = _adapter_for(provider_row)

    user_msg = f"Dashboard brief:\n{brief}"
    result, errors = {}, []
    for attempt in range(MAX_RETRIES + 1):
        result = _parse_json(adapter.generate(system, user_msg, model))
        ctx["grid_rows"] = int(result.get("gridRows") or DEFAULT_GRID_ROWS)
        elements = result.get("elements") or []
        good, errors = validate_elements(elements, ctx)
        if not errors:
            result["elements"] = good
            break
        if attempt == MAX_RETRIES:
            result["elements"] = good  # keep what is valid, report the rest
            break
        user_msg = (
            f"Dashboard brief:\n{brief}\n\n"
            "Your previous answer had validation errors. Return the FULL corrected JSON, "
            "fixing these and keeping everything that was already valid:\n- "
            + "\n- ".join(errors)
        )

    return {
        "name": result.get("name") or "Untitled dashboard",
        "description": result.get("description") or "",
        "gridRows": ctx["grid_rows"],
        "elements": result["elements"],
        "unmet": result.get("unmet") or [],
        "errors": errors,
    }


def edit_component(db: Session, user: User, provider_row, model: str, element: dict,
                   instruction: str, theme: str = "chester",
                   semantic_model=None, allowed_cubes: set | None = None) -> dict:
    """Returns {element, errors}. On unrecoverable failure the original element
    comes back unchanged with errors filled in — the caller saves nothing."""
    model_key = semantic_model.public_key if semantic_model is not None else None
    ctx = build_context(db, user, model_key, allowed_cubes)
    current_id = str((element.get("meta") or {}).get("datasetId") or "")
    current = ctx["datasets_by_id"].get(current_id)

    system = EDIT_SYSTEM.format(
        element=json.dumps(element, indent=1),
        current_dataset=(
            json.dumps({"datasetId": current_id, "name": current["name"],
                        "fields": sorted(current["fields"])})
            if current else "(this element is a filter, or its dataset no longer exists)"
        ),
        datasets=ctx["datasets_text"],
        cube_context=ctx["cube_context"],
        spec=ctx["spec"],
        grid_cols=GRID_COLS,
        palette=", ".join(_palette(theme)),
    )
    adapter = _adapter_for(provider_row)

    user_msg = f"Change request:\n{instruction}"
    for attempt in range(MAX_RETRIES + 1):
        updated = _parse_json(adapter.generate(system, user_msg, model))
        if updated.get("_error"):
            return {"element": element, "errors": [str(updated["_error"])]}
        if updated.get("id") != element.get("id"):
            updated["id"] = element["id"]  # the one error worth silently fixing
        errs = validate_element(updated, ctx)
        if not errs:
            return {"element": updated, "errors": []}
        if attempt == MAX_RETRIES:
            return {"element": element, "errors": errs}
        user_msg = (
            f"Change request:\n{instruction}\n\n"
            "Your previous answer had validation errors. Return the corrected element "
            "JSON, fixing these:\n- " + "\n- ".join(errs)
        )
