import { getQuery, runQuery, type DashboardElementMeta } from "./Api";
import { getRowFieldValue, normalizeQueryRows } from "./queryResult";

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
  };
}

export async function fetchWidgetQueryData(meta: WidgetMetaLike): Promise<WidgetQueryData> {
  if (!meta.queryId || !meta.chartConfig) {
    return { previewValue: null, previewRows: null };
  }

  const queryDetails = await getQuery(meta.queryId);
  const result = await runQuery(queryDetails.semantic_model.id, queryDetails.malloy_query);
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
