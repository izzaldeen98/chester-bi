import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface TitleField {
  value: string;
  valueFontSize?: number;
  valueFontColor?: string;
}

export interface BarChartProps {
  title?: TitleField;
  xAxis?: string;
  xAxisColor?: string;
  yAxis?: string | string[];
  yAxisColor?: string | string[];
  legend?: string | string[];
  barOrientation?: string;
  stacked?: string | boolean;
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

function isTruthy(value: string | boolean | undefined) {
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1" || value === "on";
}

function readCategoryLabel(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function readNumericValue(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
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

export default function BarChart({
  title,
  xAxis,
  xAxisColor,
  yAxis,
  yAxisColor,
  legend,
  barOrientation = "vertical",
  stacked,
  data = [],
}: BarChartProps) {
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

  const horizontal = barOrientation === "horizontal";
  const useStack = isTruthy(stacked) && yFields.length > 1;

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

    const categories = data.map((row) => readCategoryLabel(row[xAxis]));
    const hasLegend = legendLabels.length > 1;
    const titleFontSize = title?.valueFontSize ?? 14;
    const topPadding = title?.value ? titleFontSize + 28 : 16;

    const categoryAxis = {
      type: "category" as const,
      data: categories,
      axisLine: { lineStyle: { color: xAxisColor || borderColor } },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 10,
        rotate: !horizontal && categories.length > 8 ? 35 : 0,
        hideOverlap: true,
      },
    };

    const valueAxis = {
      type: "value" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: borderColor, type: "dashed" as const } },
    };

    return {
      backgroundColor: "transparent",
      title: title?.value
        ? {
            text: title.value,
            left: 8,
            top: 4,
            textStyle: {
              color: title.valueFontColor ?? textHColor,
              fontSize: titleFontSize,
              fontWeight: 600,
            },
          }
        : undefined,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: getThemeColor("--bg-subtle", "#ffffff"),
        borderColor,
        textStyle: { color: textHColor, fontSize: 12 },
      },
      legend: hasLegend
        ? {
            data: legendLabels,
            bottom: 0,
            textStyle: { color: textColor, fontSize: 11 },
            icon: "roundRect",
            itemWidth: 10,
            itemHeight: 8,
          }
        : undefined,
      grid: {
        left: horizontal ? 80 : 40,
        right: 16,
        top: topPadding,
        bottom: hasLegend ? 36 : 24,
        containLabel: false,
      },
      xAxis: horizontal ? valueAxis : { ...categoryAxis, boundaryGap: true },
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: yFields.map((field, index) => ({
        name: legendLabels[index] || field,
        type: "bar",
        stack: useStack ? "total" : undefined,
        barMaxWidth: 48,
        itemStyle: {
          color: colors[index],
          borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
        emphasis: {
          focus: useStack ? "series" : undefined,
        },
        data: data.map((row) => readNumericValue(row[field])),
      })),
    };
  }, [
    ready,
    title,
    xAxis,
    xAxisColor,
    yFields,
    colors,
    legendLabels,
    data,
    horizontal,
    useStack,
  ]);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col">
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
