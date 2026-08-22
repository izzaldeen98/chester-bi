import { useEffect, useState, type ReactNode } from "react";
import type { FilterRule } from "./FilterEditDialog";
import CardChart from "./charts/CardChart/CardChart";
import LineChart from "./charts/LineChart";
import BarChart from "./charts/BarChart";
import PieChart from "./charts/PieChart";
import TableChart from "./charts/TableChart";
import WaterfallChart from "./charts/WaterfallChart";
import TreemapChart from "./charts/TreemapChart";
import ScatterChart from "./charts/ScatterChart";
import CSpinner from "./CSpinner";
import {
  fetchWidgetQueryData,
  type WidgetMetaLike,
  type WidgetQueryData,
} from "../lib/dashboardWidgetData";

function isConfigTruthy(value: string | undefined) {
  return value === "true" || value === "1" || value === "on";
}

export function renderWidgetChart(
  meta: WidgetMetaLike,
  data?: WidgetQueryData | null,
): ReactNode {
  if (!meta.datasetId || !meta.chartConfig) return undefined;

  const cfg = meta.chartConfig;
  const previewValue = data?.previewValue ?? meta.previewValue ?? null;
  const previewRows = data?.previewRows ?? meta.previewRows ?? [];

  if (meta.chartType === "card") {
    const hasTarget = isConfigTruthy(cfg.hasTarget);
    const hasCompare = isConfigTruthy(cfg.hasCompare);
    const displayValue = previewValue ?? (cfg.value ? Number(cfg.value) : 0);
    const compareValue = data?.compareValue ?? null;
    const valueFormat = (cfg.valueFormat as "currency" | "percentage" | "number" | "decimal") || "currency";

    return (
      <CardChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        value={{
          value: Number.isFinite(displayValue) ? displayValue : 0,
          valueFontSize: Number(cfg.valueFontSize) || undefined,
          valueFontColor: cfg.valueFontColor || undefined,
        }}
        target={hasTarget ? { value: Number(cfg.target) || 0 } : undefined}
        targetBarColor={cfg.targetBarColor || "#eab308"}
        compare={hasCompare && compareValue !== null ? { value: compareValue } : undefined}
        compareLabel={cfg.compareLabel || "vs"}
        compareFormat={(cfg.compareFormat as "currency" | "percentage" | "number" | "decimal") || valueFormat}
        valueFormat={valueFormat}
      />
    );
  }

  if (meta.chartType === "line") {
    return (
      <LineChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        xAxis={cfg.xAxis}
        xAxisColor={cfg.xAxisColor}
        yAxis={cfg.yAxis}
        yAxisColor={cfg.yAxisColor}
        legend={cfg.legend}
        lineType={cfg.lineType}
        format={cfg.format}
        yAxisFormat={cfg.yAxisFormat}
        showDataPoints={cfg.showDataPoints}
        xAxisIsDateTime={cfg.xAxisIsDateTime === "true" || Boolean(cfg.format?.trim())}
        data={previewRows}
      />
    );
  }

  if (meta.chartType === "bar") {
    return (
      <BarChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        xAxis={cfg.xAxis}
        xAxisColor={cfg.xAxisColor}
        yAxis={cfg.yAxis}
        yAxisColor={cfg.yAxisColor}
        legend={cfg.legend}
        barOrientation={cfg.barOrientation}
        stacked={cfg.stacked}
        data={previewRows}
      />
    );
  }

  if (meta.chartType === "scatter") {
    return (
      <ScatterChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        xAxis={cfg.xAxis}
        xAxisColor={cfg.xAxisColor}
        yAxis={cfg.yAxis}
        yAxisColor={cfg.yAxisColor}
        legend={cfg.legend}
        pointSize={cfg.pointSize}
        yAxisFormat={cfg.yAxisFormat}
        data={previewRows}
      />
    );
  }

  if (meta.chartType === "pie") {
    return (
      <PieChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        category={cfg.category}
        value={cfg.value}
        sliceColor={cfg.sliceColor}
        legend={cfg.legend}
        radius={cfg.radius}
        showValue={cfg.showValue}
        showPercentage={cfg.showPercentage}
        valuePosition={cfg.valuePosition}
        data={previewRows}
      />
    );
  }

  if (meta.chartType === "waterfall") {
    return (
      <WaterfallChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        xAxis={cfg.xAxis}
        xAxisColor={cfg.xAxisColor}
        format={cfg.format}
        xAxisIsDateTime={cfg.xAxisIsDateTime === "true" || Boolean(cfg.format?.trim())}
        value={cfg.value}
        valueFormat={cfg.valueFormat}
        increaseColor={cfg.increaseColor}
        decreaseColor={cfg.decreaseColor}
        showConnectors={cfg.showConnectors}
        showValue={cfg.showValue}
        legend={cfg.legend}
        data={previewRows}
      />
    );
  }

  if (meta.chartType === "treemap") {
    return (
      <TreemapChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        category={cfg.category}
        value={cfg.value}
        valueFormat={cfg.valueFormat}
        tileColor={cfg.tileColor}
        showValue={cfg.showValue}
        data={previewRows}
      />
    );
  }

  if (meta.chartType === "table") {
    return (
      <TableChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        columns={cfg.columns}
        pageSize={cfg.pageSize}
        striped={cfg.striped}
        showIndex={cfg.showIndex}
        data={previewRows}
      />
    );
  }

  return undefined;
}

interface DashboardWidgetChartProps {
  meta: WidgetMetaLike;
  /** Stable ID for this widget — used to match filter targets. */
  widgetId?: string;
  /** Use in-session preview data when present (workspace editor). View mode always fetches live. */
  preferCachedPreview?: boolean;
  /** Dashboard-level filter rules for slice-and-dice query injection. */
  activeFilters?: FilterRule[];
}

export default function DashboardWidgetChart({
  meta,
  widgetId,
  preferCachedPreview = false,
  activeFilters = [],
}: DashboardWidgetChartProps) {
  const hasCachedPreview =
    preferCachedPreview && (meta.previewRows != null || meta.previewValue != null);

  // Serialize active filters so we can use them as a useEffect dep
  const activeFiltersKey = JSON.stringify(activeFilters);

  const [liveData, setLiveData] = useState<WidgetQueryData | null>(null);
  const [loading, setLoading] = useState(!hasCachedPreview && Boolean(meta.datasetId && meta.chartConfig));
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasCachedPreview || !meta.datasetId || !meta.chartConfig) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetchWidgetQueryData(meta, { widgetId, activeFilters })
      .then((data) => {
        if (!cancelled) setLiveData(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to run query.");
          setLiveData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // activeFiltersKey triggers re-fetch when any filter value changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCachedPreview, meta.datasetId, meta.chartType, JSON.stringify(meta.chartConfig), activeFiltersKey]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <CSpinner size={20} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-gray-400">
        {error}
      </div>
    );
  }

  const data = hasCachedPreview
    ? { previewValue: meta.previewValue ?? null, previewRows: meta.previewRows ?? null }
    : liveData;

  return renderWidgetChart(meta, data);
}
