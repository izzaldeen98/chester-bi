import { getQuery, runQuery, type DashboardElementMeta } from "./Api";
import { getRowFieldValue, normalizeQueryRows } from "./queryResult";
import type { FilterRule } from "../components/FilterEditDialog";
import { buildMalloyFilterClause, injectFiltersIntoQuery } from "./filterInjection";

export interface WidgetQueryData {
  previewValue: number | null;
  previewRows: Record<string, unknown>[] | null;
  compareValue?: number | null;
}

export interface WidgetMetaLike {
  title: string;
  query?: string;
  queryId?: string;
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
    queryId: meta.queryId,
    chartType: meta.chartType,
    chartConfig: meta.chartConfig,
    filterRule: meta.filterRule as Record<string, unknown> | undefined,
  };
}

export async function fetchWidgetQueryData(
  meta: WidgetMetaLike,
  options?: { widgetId?: string; activeFilters?: FilterRule[] },
): Promise<WidgetQueryData> {
  if (!meta.queryId || !meta.chartConfig) {
    return { previewValue: null, previewRows: null };
  }

  const queryDetails = await getQuery(meta.queryId);
  const modelId = queryDetails.semantic_model.id;

  // Build extra where clauses from dashboard-level active filters
  const { widgetId, activeFilters = [] } = options ?? {};
  const filterClauses: string[] = [];
  for (const rule of activeFilters) {
    // Skip if filter targets specific widgets and this one is not included
    if (rule.targetWidgetIds.length > 0 && widgetId && !rule.targetWidgetIds.includes(widgetId)) continue;
    // Find the mapping for this model
    const mapping = rule.mappings.find((m) => m.modelId === modelId);
    if (!mapping) continue;
    const clause = buildMalloyFilterClause(rule, mapping.fieldName);
    if (clause) filterClauses.push(clause);
  }

  const malloyQuery = injectFiltersIntoQuery(queryDetails.malloy_query, filterClauses);
  const result = await runQuery(modelId, malloyQuery);
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
