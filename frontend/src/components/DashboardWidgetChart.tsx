import { useEffect, useState, type ReactNode } from "react";
import CardChart from "./charts/CardChart/CardChart";
import LineChart from "./charts/LineChart";
import BarChart from "./charts/BarChart";
import PieChart from "./charts/PieChart";
import TableChart from "./charts/TableChart";
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
  if (!meta.queryId || !meta.chartConfig) return undefined;

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
  /** Use in-session preview data when present (workspace editor). View mode always fetches live. */
  preferCachedPreview?: boolean;
}

export default function DashboardWidgetChart({ meta, preferCachedPreview = false }: DashboardWidgetChartProps) {
  const hasCachedPreview =
    preferCachedPreview && (meta.previewRows != null || meta.previewValue != null);

  const [liveData, setLiveData] = useState<WidgetQueryData | null>(null);
  const [loading, setLoading] = useState(!hasCachedPreview && Boolean(meta.queryId && meta.chartConfig));
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasCachedPreview || !meta.queryId || !meta.chartConfig) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetchWidgetQueryData(meta)
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
  }, [hasCachedPreview, meta.queryId, meta.chartType, JSON.stringify(meta.chartConfig)]);

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
