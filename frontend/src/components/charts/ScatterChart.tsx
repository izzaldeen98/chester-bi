import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getRowFieldValue } from "../../lib/queryResult";

interface TitleField {
  value: string;
  valueFontSize?: number;
  valueFontColor?: string;
}

export interface ScatterChartProps {
  title?: TitleField;
  xAxis?: string;
  xAxisColor?: string;
  yAxis?: string | string[];
  yAxisColor?: string | string[];
  legend?: string | string[];
  pointSize?: string | number;
  yAxisFormat?: string;
  data?: Record<string, unknown>[];
}

const DEFAULT_SERIES_COLORS = [
  "#eab308",
  "#3b82f6",
  "#10b981",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
];

function getThemeColor(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function parseList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((part) => part.trim()).filter(Boolean);
}

function readNumericValue(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

function formatAxisValue(value: unknown, format?: string): string {
  const num = readNumericValue(value);
  if (num == null) return "";

  switch (format) {
    case "currency":
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "decimal":
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "number":
      return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
    default:
      return num.toLocaleString();
  }
}

function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

export default function ScatterChart({
  title,
  xAxis,
  xAxisColor,
  yAxis,
  yAxisColor,
  legend,
  pointSize,
  yAxisFormat,
  data = [],
}: ScatterChartProps) {
  const { ref, width, height } = useContainerSize();
  const ready = width > 0 && height > 0;

  const yFields = useMemo(() => parseList(yAxis), [yAxis]);
  const colors = useMemo(() => {
    const parsed = parseList(yAxisColor);
    return yFields.map((_, index) => parsed[index] || DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length]);
  }, [yAxisColor, yFields]);

  const legendLabels = useMemo(() => {
    const parsed = parseList(legend);
    return yFields.map((field, index) => parsed[index] || field);
  }, [legend, yFields]);

  const symbolSize = Number(pointSize) > 0 ? Number(pointSize) : 8;

  const option = useMemo<EChartsOption>(() => {
    if (!ready) return { backgroundColor: "transparent" };

    const textColor = getThemeColor("--text", "#6b7280");
    const textHColor = getThemeColor("--text-h", "#111827");
    const borderColor = getThemeColor("--border", "#e5e7eb");

    if (!xAxis || yFields.length === 0 || data.length === 0) {
      return {
        backgroundColor: "transparent",
        title: {
          text: "Configure X axis, Y axis, and run query",
          left: "center",
          top: "middle",
          textStyle: { color: textColor, fontSize: 12, fontWeight: 500 },
        },
      };
    }

    const hasLegend = legendLabels.length > 1;
    const hasTitle = Boolean(title?.value);
    const titleFontSize = title?.valueFontSize ?? 14;
    // ECharts title component: top=6, internal padding 5px top+bottom, lineHeight≈fontSize×1.2
    // So title bottom ≈ 6 + 5 + fontSize×1.2 + 5 = fontSize×1.2 + 16
    // Add 8px breathing room before the grid starts
    const titleSpace = hasTitle ? Math.ceil(titleFontSize * 1.2 + 24) : 10;
    const legendTop = hasTitle ? Math.ceil(titleFontSize * 1.2 + 16) : 6;
    const gridTop = titleSpace + (hasLegend ? 28 : 0);

    const series = yFields.map((field, index) => {
      const points: [number, number][] = [];
      for (const row of data) {
        const x = readNumericValue(getRowFieldValue(row, xAxis));
        const y = readNumericValue(getRowFieldValue(row, field));
        if (x != null && y != null) points.push([x, y]);
      }
      return {
        name: legendLabels[index] || field,
        type: "scatter" as const,
        symbolSize,
        itemStyle: { color: colors[index], opacity: 0.85 },
        emphasis: { itemStyle: { opacity: 1, borderWidth: 2, borderColor: "#ffffff" } },
        data: points,
      };
    });

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 600,
      animationEasing: "cubicOut" as const,

      title: hasTitle
        ? {
            text: title?.value ?? "",
            left: 10,
            top: 6,
            textStyle: {
              color: title?.valueFontColor ?? textHColor,
              fontSize: titleFontSize,
              fontWeight: 700,
            },
          }
        : undefined,

      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        borderRadius: 10,
        padding: [8, 14],
        textStyle: { color: textHColor, fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 20px rgba(0,0,0,0.10); border-radius: 10px;",
        formatter: (p: any) =>
          `${p.marker}${p.seriesName}<br/>${xAxis}: ${formatAxisValue(p.value[0])}<br/>${p.seriesName}: ${formatAxisValue(p.value[1], yAxisFormat)}`,
      },

      legend: hasLegend
        ? {
            data: legendLabels,
            top: legendTop,
            left: "center",
            orient: "horizontal",
            textStyle: { color: textColor, fontSize: 11 },
            icon: "circle",
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 16,
          }
        : undefined,

      grid: {
        left: 4,
        right: 12,
        top: gridTop,
        bottom: 4,
        containLabel: true,
      },

      xAxis: {
        type: "value",
        name: xAxis,
        nameGap: 24,
        nameLocation: "middle",
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLine: { show: true, lineStyle: { color: xAxisColor || borderColor, width: 1 } },
        axisTick: { show: false },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: borderColor, type: "dashed", width: 1, opacity: 0.7 } },
      },

      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          margin: 8,
          formatter: (value: number) => formatAxisValue(value, yAxisFormat),
        },
        splitLine: { lineStyle: { color: borderColor, type: "dashed", width: 1, opacity: 0.7 } },
      },

      series,
    };
  }, [ready, title, xAxis, xAxisColor, yFields, colors, legendLabels, data, yAxisFormat, symbolSize]);

  return (
    <div className="pointer-events-auto flex h-full w-full min-h-0 min-w-0 flex-col p-2">
      <div ref={ref} className="h-full w-full min-h-0 min-w-0 flex-1">
        {ready && (
          <ReactECharts
            option={option}
            style={{ width: "100%", height: "100%" }}
            notMerge
            lazyUpdate
            opts={{ renderer: "canvas" }}
          />
        )}
      </div>
    </div>
  );
}
