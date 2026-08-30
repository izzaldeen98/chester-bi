import { getDataset, runQuery, type DashboardElementMeta } from "./Api";
import { getRowFieldValue, normalizeQueryRows } from "./queryResult";
import type { FilterRule } from "../components/FilterEditDialog";
import { buildCubeFilterExpr, injectFiltersIntoQuery } from "./filterInjection";
import type { CubeFilterExpr } from "./cubeTypes";

export interface WidgetQueryData {
  previewValue: number | null;
  previewRows: Record<string, unknown>[] | null;
  compareValue?: number | null;
}

export interface WidgetMetaLike {
  title: string;
  query?: string;
  datasetId?: string;
  chartType?: string;
  chartConfig?: Record<string, string>;
  previewValue?: number | null;
  previewRows?: Record<string, unknown>[] | null;
  filterRule?: FilterRule;
}

function readNumericFromRows(rows: Record<string, unknown>[], fieldName: string): number | null {
  if (!fieldName || rows.length === 0) return null;
  const raw = getRowFieldValue(rows[0], fieldName);
  if (raw == null) return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(num) ? num : null;
}

/** Persist only layout + query reference + chart config — not query result rows. */
export function toSavedWidgetMeta(meta: WidgetMetaLike): DashboardElementMeta {
  return {
    title: meta.title,
    query: meta.query,
    datasetId: meta.datasetId,
    chartType: meta.chartType,
    chartConfig: meta.chartConfig,
    filterRule: meta.filterRule as Record<string, unknown> | undefined,
  };
}

export async function fetchWidgetQueryData(
  meta: WidgetMetaLike,
  options?: { widgetId?: string; activeFilters?: FilterRule[] },
): Promise<WidgetQueryData> {
  if (!meta.datasetId || !meta.chartConfig) {
    return { previewValue: null, previewRows: null };
  }

  const datasetDetails = await getDataset(meta.datasetId);
  const definitionId = datasetDetails.definition.id;

  // Build extra filter expressions from dashboard-level active filters
  const { widgetId, activeFilters = [] } = options ?? {};
  const filterExprs: CubeFilterExpr[] = [];
  for (const rule of activeFilters) {
    // Skip if filter targets specific widgets and this one is not included
    if (rule.targetWidgetIds.length > 0 && widgetId && !rule.targetWidgetIds.includes(widgetId)) continue;
    // Find the mapping for this definition
    const mapping = rule.mappings.find((m) => m.definitionId === definitionId);
    if (!mapping) continue;
    const expr = buildCubeFilterExpr(rule, `${mapping.sourceName}.${mapping.fieldName}`);
    if (expr) filterExprs.push(expr);
  }

  let cubeQuery = injectFiltersIntoQuery(datasetDetails.cube_query, filterExprs);
  // The dataset's limit is meant to keep its own editor preview cheap — it
  // only carries over to dashboards when the dataset opted in via limit_enabled.
  if (!datasetDetails.limit_enabled && "limit" in cubeQuery) {
    const { limit: _limit, ...unlimited } = cubeQuery;
    cubeQuery = unlimited;
  }
  const result = await runQuery(definitionId, cubeQuery);
  const rows = normalizeQueryRows(result);

  if (meta.chartType === "card") {
    const valueField = meta.chartConfig.value?.trim();
    const hasCompare =
      meta.chartConfig.hasCompare === "true" || meta.chartConfig.hasCompare === "1";
    const compareField = meta.chartConfig.compareField?.trim();
    return {
      previewValue: readNumericFromRows(rows, valueField ?? ""),
      previewRows: null,
      compareValue: hasCompare && compareField ? readNumericFromRows(rows, compareField) : null,
    };
  }

  return { previewValue: null, previewRows: rows };
}
