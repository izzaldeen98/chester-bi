import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { formatAxisValue, formatYAxisValue } from "./LineChart";
import { getRowFieldValue } from "../../lib/queryResult";

interface TitleField {
  value: string;
  valueFontSize?: number;
  valueFontColor?: string;
}

export interface WaterfallChartProps {
  title?: TitleField;
  xAxis?: string;
  xAxisColor?: string;
  format?: string;
  xAxisIsDateTime?: boolean;
  value?: string;
  valueFormat?: string;
  increaseColor?: string;
  decreaseColor?: string;
  showConnectors?: string | boolean;
  showValue?: string | boolean;
  legend?: string | string[];
  data?: Record<string, unknown>[];
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

/**
 * Classic waterfall recipe: a transparent "base" series carries each bar up
 * to its floor, stacked with colored increase/decrease series so the bars
 * appear to float from the running balance rather than from zero.
 */
function computeWaterfallSeries(values: (number | null)[]) {
  const base: (number | null)[] = [];
  const increase: (number | null)[] = [];
  const decrease: (number | null)[] = [];
  const runningTop: (number | null)[] = [];

  let running = 0;
  values.forEach((v) => {
    if (v == null) {
      base.push(null);
      increase.push(null);
      decrease.push(null);
      runningTop.push(null);
      return;
    }

    if (v >= 0) {
      base.push(running);
      increase.push(v);
      decrease.push(0);
      running += v;
    } else {
      running += v;
      base.push(running);
      decrease.push(-v);
      increase.push(0);
    }
    runningTop.push(running);
  });

  return { base, increase, decrease, runningTop };
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

export default function WaterfallChart({
  title,
  xAxis,
  xAxisColor,
  format,
  xAxisIsDateTime = false,
  value,
  valueFormat,
  increaseColor = "#10b981",
  decreaseColor = "#ef4444",
  showConnectors = "true",
  showValue = "false",
  legend,
  data = [],
}: WaterfallChartProps) {
  const { ref, width, height } = useContainerSize();
  const ready = width > 0 && height > 0;

  const legendLabels = useMemo(() => {
    const parsed = parseList(legend);
    return {
      increase: parsed[0] || "Increase",
      decrease: parsed[1] || "Decrease",
    };
  }, [legend]);

  const connectors = isTruthy(showConnectors);
  const showLabels = isTruthy(showValue);
  const useDateFormat = xAxisIsDateTime && Boolean(format?.trim());

  const option = useMemo<EChartsOption>(() => {
    if (!ready) return { backgroundColor: "transparent" };

    const textColor = getThemeColor("--text", "#6b7280");
    const textHColor = getThemeColor("--text-h", "#111827");
    const borderColor = getThemeColor("--border", "#e5e7eb");

    if (!xAxis || !value || data.length === 0) {
      return {
        backgroundColor: "transparent",
        title: {
          text: "Configure X axis, Value, and run query",
          left: "center",
          top: "middle",
          textStyle: { color: textColor, fontSize: 12, fontWeight: 500 },
        },
      };
    }

    const categories = data.map((row) => {
      const raw = getRowFieldValue(row, xAxis);
      return useDateFormat ? formatAxisValue(raw, format) : readCategoryLabel(raw);
    });
    const values = data.map((row) => readNumericValue(getRowFieldValue(row, value)));
    const { base, increase, decrease, runningTop } = computeWaterfallSeries(values);

    const hasTitle = Boolean(title?.value);
    const titleFontSize = title?.valueFontSize ?? 14;
    const gridTop = hasTitle ? Math.ceil(titleFontSize * 1.2 + 24) : 10;
    const rotateX = categories.length > 8;

    const labelFormatter = (params: { value?: unknown }) => {
      const v = readNumericValue(params.value);
      return v != null ? formatYAxisValue(v, valueFormat) : "";
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
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(0,0,0,0.04)" } },
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        borderRadius: 10,
        padding: [8, 14],
        textStyle: { color: textHColor, fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 20px rgba(0,0,0,0.10); border-radius: 10px;",
        valueFormatter: (v) => (v == null ? "" : formatYAxisValue(v, valueFormat)),
      },

      grid: {
        left: 4,
        right: 12,
        top: gridTop,
        bottom: 4,
        containLabel: true,
      },

      xAxis: {
        type: "category",
        data: categories,
        // Drawn above the bar series (default series z: 2) so the axis line
        // and labels stay visible even when a bar sits flush on the zero line.
        z: 3,
        axisLine: { lineStyle: { color: xAxisColor || borderColor, width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          rotate: rotateX ? 35 : 0,
          margin: rotateX ? 8 : 4,
          hideOverlap: true,
        },
      },

      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          margin: 8,
          formatter: (v: number) => formatYAxisValue(v, valueFormat),
        },
        splitLine: {
          lineStyle: { color: borderColor, type: "dashed" as const, width: 1, opacity: 0.7 },
        },
      },

      series: [
        {
          name: "Base",
          type: "bar",
          stack: "total",
          stackStrategy: "all",
          silent: true,
          tooltip: { show: false },
          itemStyle: { color: "transparent" },
          data: base,
        },
        {
          name: legendLabels.increase,
          type: "bar",
          stack: "total",
          stackStrategy: "all",
          barMaxWidth: 48,
          itemStyle: { color: increaseColor },
          label: { show: showLabels, position: "top", fontSize: 10, color: textColor, formatter: labelFormatter },
          emphasis: { focus: "series" as const },
          data: increase,
        },
        {
          name: legendLabels.decrease,
          type: "bar",
          stack: "total",
          stackStrategy: "all",
          barMaxWidth: 48,
          itemStyle: { color: decreaseColor },
          label: { show: showLabels, position: "top", fontSize: 10, color: textColor, formatter: labelFormatter },
          emphasis: { focus: "series" as const },
          data: decrease,
        },
        ...(connectors
          ? [
              {
                name: "Connector",
                type: "line" as const,
                step: "end" as const,
                symbol: "none" as const,
                silent: true,
                tooltip: { show: false },
                lineStyle: { color: borderColor, width: 1, type: "dashed" as const },
                data: runningTop,
              },
            ]
          : []),
      ],
    };
  }, [
    ready,
    title,
    xAxis,
    xAxisColor,
    format,
    useDateFormat,
    value,
    valueFormat,
    increaseColor,
    decreaseColor,
    connectors,
    showLabels,
    legendLabels,
    data,
  ]);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col p-2">
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