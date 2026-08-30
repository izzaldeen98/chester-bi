import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getRowFieldValue } from "../../lib/queryResult";

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

// Validated categorical palette (fixed hue order, CVD-checked) — see dataviz skill.
const SERIES_COLORS_LIGHT = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948",
];
const SERIES_COLORS_DARK = [
  "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767",
];

function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

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
    const palette = isDarkMode() ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT;
    return yFields.map((_, index) => parsed[index] || palette[index % palette.length]);
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

    const categories = data.map((row) => readCategoryLabel(getRowFieldValue(row, xAxis)));
    const hasLegend = legendLabels.length > 1;
    const hasTitle = Boolean(title?.value);
    const titleFontSize = title?.valueFontSize ?? 14;
    // Same formula as LineChart: account for ECharts title internal padding + lineHeight
    const titleSpace = hasTitle ? Math.ceil(titleFontSize * 1.2 + 24) : 10;
    const legendTop = hasTitle ? Math.ceil(titleFontSize * 1.2 + 16) : 6;
    const gridTop = titleSpace + (hasLegend ? 28 : 0);
    const rotateX = !horizontal && categories.length > 8;

    const categoryAxis = {
      type: "category" as const,
      data: categories,
      axisLine: { lineStyle: { color: xAxisColor || borderColor, width: 1 } },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 10,
        rotate: rotateX ? 35 : 0,
        margin: rotateX ? 8 : 4,
        hideOverlap: true,
      },
    };

    const valueAxis = {
      type: "value" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: textColor, fontSize: 10, margin: 8 },
      splitLine: {
        lineStyle: { color: borderColor, width: 1 },
      },
    };

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut" as const,

      title: hasTitle
        ? {
            text: title!.value,
            left: 10,
            top: 6,
            textStyle: {
              color: title!.valueFontColor ?? textHColor,
              fontSize: titleFontSize,
              fontWeight: 700,
            },
          }
        : undefined,

      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: { color: "rgba(0,0,0,0.04)" },
        },
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        borderRadius: 10,
        padding: [8, 14],
        textStyle: { color: textHColor, fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 20px rgba(0,0,0,0.10); border-radius: 10px;",
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
        left: horizontal ? 4 : 4,
        right: 12,
        top: gridTop,
        bottom: hasLegend ? 8 : 4,
        containLabel: true,
      },

      xAxis: horizontal ? valueAxis : { ...categoryAxis, boundaryGap: true },
      yAxis: horizontal ? { ...categoryAxis, inverse: true } : valueAxis,

      series: yFields.map((field, index) => ({
        name: legendLabels[index] || field,
        type: "bar",
        stack: useStack ? "total" : undefined,
        // Mark spec: bars stay thin (never fill the category slot) with visible
        // air between them, and a small rounded data-end anchored to a square baseline.
        barMaxWidth: horizontal ? 20 : 22,
        barCategoryGap: "45%",
        barGap: useStack ? undefined : "30%",
        itemStyle: {
          color: colors[index],
          borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
        label: {
          show: useStack,
          position: "inside" as const,
          fontSize: 10,
          color: "#ffffff",
          formatter: (params: { value?: unknown }) => {
            const v = readNumericValue(params.value);
            return v != null && v !== 0 ? String(v) : "";
          },
        },
        emphasis: {
          focus: "series" as const,
          itemStyle: {
            shadowBlur: 8,
            shadowColor: `${colors[index]}40`,
            shadowOffsetY: 2,
          },
        },
        data: data.map((row) => readNumericValue(getRowFieldValue(row, field))),
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
