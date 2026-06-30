import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getRowFieldValue } from "../../lib/queryResult";

interface TitleField {
  value: string;
  valueFontSize?: number;
  valueFontColor?: string;
}

export interface PieChartProps {
  title?: TitleField;
  category?: string;
  value?: string;
  sliceColor?: string | string[];
  legend?: string | string[];
  radius?: string | number;
  showPercentage?: string | boolean;
  showValue?: string | boolean;
  valuePosition?: string;
  data?: Record<string, unknown>[];
}

const DEFAULT_SLICE_COLORS = [
  "#eab308",
  "#3b82f6",
  "#10b981",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
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

const OUTER_RADIUS = "70%";

function parseRadiusNumber(radius: string | number | undefined): number {
  if (radius == null || radius === "") return 0;
  if (typeof radius === "number") return Math.max(0, radius);
  const trimmed = radius.trim();
  if (!trimmed) return 0;
  const num = parseFloat(trimmed.replace("%", ""));
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function formatPieRadius(radius: string | number | undefined): string | [string, string] {
  const inner = parseRadiusNumber(radius);
  if (inner <= 0) return OUTER_RADIUS;
  return [`${inner}%`, OUTER_RADIUS];
}

function buildSliceLabel(
  showValue: boolean,
  showPercentage: boolean,
  valuePosition?: string,
): string {
  const isSide = valuePosition === "left" || valuePosition === "right";
  const withValue = showValue || isSide;
  const withPct = showPercentage;

  if (withValue && withPct) return isSide ? "{b}: {c} ({d}%)" : "{b}\n{c} ({d}%)";
  if (withValue) return isSide ? "{b}: {c}" : "{b}\n{c}";
  if (withPct) return isSide ? "{b}: {d}%" : "{b}\n{d}%";
  return "{b}";
}

function buildTooltipFormatter(showValue: boolean, showPercentage: boolean): string {
  if (showValue && showPercentage) return "{b}: {c} ({d}%)";
  if (showValue) return "{b}: {c}";
  if (showPercentage) return "{b}: {d}%";
  return "{b}";
}

function buildSideLegendFormatter(
  slices: { name: string; value: number }[],
  showPercentage: boolean,
) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (name: string) => {
    const slice = slices.find((item) => item.name === name);
    if (!slice) return name;
    let text = `${name}: ${slice.value.toLocaleString()}`;
    if (showPercentage && total > 0) {
      const pct = ((slice.value / total) * 100).toFixed(1);
      text += ` (${pct}%)`;
    }
    return text;
  };
}

function resolveLabelLayout(valuePosition: string | undefined) {
  const isSide = valuePosition === "left" || valuePosition === "right";
  if (isSide) {
    return { showSliceLabels: false, showLabelLine: false };
  }

  switch (valuePosition) {
    case "outside":
      return { position: "outside" as const, showSliceLabels: true, showLabelLine: true };
    case "center":
      return { position: "center" as const, showSliceLabels: true, showLabelLine: false };
    case "inside":
    default:
      return { position: "inside" as const, showSliceLabels: true, showLabelLine: false };
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

export default function PieChart({
  title,
  category,
  value,
  sliceColor,
  legend,
  radius,
  showPercentage,
  showValue,
  valuePosition = "inside",
  data = [],
}: PieChartProps) {
  const { ref, width, height } = useContainerSize();
  const ready = width > 0 && height > 0;

  const colors = useMemo(() => parseList(sliceColor), [sliceColor]);
  const legendLabels = useMemo(() => parseList(legend), [legend]);
  const showPct = isTruthy(showPercentage);
  const showVal = isTruthy(showValue);
  const isSideLayout = valuePosition === "left" || valuePosition === "right";
  const pieRadius = useMemo(() => formatPieRadius(radius), [radius]);
  const labelFormatter = useMemo(
    () => buildSliceLabel(showVal, showPct, valuePosition),
    [showVal, showPct, valuePosition],
  );
  const tooltipFormatter = useMemo(() => buildTooltipFormatter(showVal, showPct), [showVal, showPct]);
  const labelLayout = useMemo(() => resolveLabelLayout(valuePosition), [valuePosition]);

  const option = useMemo<EChartsOption>(() => {
    if (!ready) return { backgroundColor: "transparent" };

    const textColor = getThemeColor("--text", "#6b7280");
    const textHColor = getThemeColor("--text-h", "#111827");
    const borderColor = getThemeColor("--border", "#e5e7eb");

    if (!category || !value || data.length === 0) {
      return {
        backgroundColor: "transparent",
        title: {
          text: "Configure category, value, and run query",
          left: "center",
          top: "middle",
          textStyle: { color: textColor, fontSize: 12, fontWeight: 500 },
        },
      };
    }

    const slices = data
      .map((row, index) => {
        const sliceValue = readNumericValue(getRowFieldValue(row, value!));
        if (sliceValue == null) return null;
        const label = legendLabels[index] || readCategoryLabel(getRowFieldValue(row, category!)) || `Slice ${index + 1}`;
        return {
          name: label,
          value: sliceValue,
          itemStyle: {
            color: colors[index] || DEFAULT_SLICE_COLORS[index % DEFAULT_SLICE_COLORS.length],
          },
        };
      })
      .filter((slice): slice is NonNullable<typeof slice> => slice != null)
      .sort((a, b) => b.value - a.value);

    if (slices.length === 0) {
      return {
        backgroundColor: "transparent",
        title: {
          text: "No numeric values found for the selected field",
          left: "center",
          top: "middle",
          textStyle: { color: textColor, fontSize: 12, fontWeight: 500 },
        },
      };
    }

    const titleFontSize = title?.valueFontSize ?? 14;
    const hasTitle = Boolean(title?.value);
    const hasBottomLegend = slices.length > 1 && !isSideLayout;
    const pieCenterX = isSideLayout ? (valuePosition === "left" ? "62%" : "38%") : "50%";
    const pieCenterY = hasTitle ? "52%" : "50%";

    return {
      backgroundColor: "transparent",
      title: hasTitle
        ? {
            text: title?.value ?? "",
            left: 8,
            top: 4,
            textStyle: {
              color: title?.valueFontColor ?? textHColor,
              fontSize: titleFontSize,
              fontWeight: 600,
            },
          }
        : undefined,
      tooltip: {
        trigger: "item",
        backgroundColor: getThemeColor("--bg-subtle", "#ffffff"),
        borderColor,
        textStyle: { color: textHColor, fontSize: 12 },
        formatter: tooltipFormatter,
      },
      legend: isSideLayout
        ? {
            type: "scroll",
            orient: "vertical",
            left: valuePosition === "left" ? 8 : undefined,
            right: valuePosition === "right" ? 8 : undefined,
            top: "middle",
            data: slices.map((slice) => slice.name),
            formatter: buildSideLegendFormatter(slices, showPct),
            textStyle: { color: textHColor, fontSize: 11 },
            icon: "circle",
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 10,
          }
        : hasBottomLegend
          ? {
              type: "scroll",
              orient: "horizontal",
              bottom: 0,
              data: slices.map((slice) => slice.name),
              textStyle: { color: textColor, fontSize: 11 },
              icon: "circle",
              itemWidth: 8,
              itemHeight: 8,
            }
          : undefined,
      series: [
        {
          type: "pie",
          radius: pieRadius,
          center: [pieCenterX, pieCenterY],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: getThemeColor("--bg", "#ffffff"),
            borderWidth: 2,
          },
          label: {
            show: labelLayout.showSliceLabels,
            color: textHColor,
            fontSize: 11,
            formatter: labelFormatter,
            position: "position" in labelLayout ? labelLayout.position : undefined,
          },
          labelLine: {
            show: labelLayout.showLabelLine,
            lineStyle: { color: borderColor },
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.15)",
            },
          },
          data: slices,
        },
      ],
    };
  }, [ready, title, category, value, data, colors, legendLabels, labelFormatter, tooltipFormatter, pieRadius, labelLayout, valuePosition, showPct, isSideLayout]);

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
