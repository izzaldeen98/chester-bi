import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getRowFieldValue } from "../../lib/queryResult";

interface TitleField {
  value: string;
  valueFontSize?: number;
  valueFontColor?: string;
}

export interface LineChartProps {
  title?: TitleField;
  xAxis?: string;
  xAxisColor?: string;
  yAxis?: string | string[];
  yAxisColor?: string | string[];
  legend?: string | string[];
  lineType?: string;
  format?: string;
  yAxisFormat?: string;
  showDataPoints?: string | boolean;
  xAxisIsDateTime?: boolean;
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

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
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

export function formatAxisValue(value: unknown, format?: string): string {
  if (!format?.trim()) return readCategoryLabel(value);

  const date = parseDateValue(value);
  if (!date) return readCategoryLabel(value);

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ymd = `${year}-${pad2(month + 1)}-${pad2(day)}`;
  const dmy = `${pad2(day)}/${pad2(month + 1)}/${year}`;
  const time = `${pad2(hours)}:${pad2(minutes)}`;
  const timeSec = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

  switch (format) {
    case "yyyy-mm-dd":
      return ymd;
    case "yyyy-mm-dd hh:mm:ss":
      return `${ymd} ${timeSec}`;
    case "yyyy-mm-dd hh:mm":
      return `${ymd} ${time}`;
    case "mmm day":
      return `${MONTHS_SHORT[month]} ${day}`;
    case "mmm day, yyyy":
      return `${MONTHS_SHORT[month]} ${day}, ${year}`;
    case "dd/mm/yyyy":
      return dmy;
    case "dd/mm/yyyy hh:mm:ss":
      return `${dmy} ${timeSec}`;
    case "dd/mm/yyyy hh:mm":
      return `${dmy} ${time}`;
    case "dd mmmm yyyy":
      return `${pad2(day)} ${MONTHS_LONG[month]} ${year}`;
    case "dd mmmm yyyy hh:mm:ss":
      return `${pad2(day)} ${MONTHS_LONG[month]} ${year} ${timeSec}`;
    case "dd mmmm yyyy hh:mm":
      return `${pad2(day)} ${MONTHS_LONG[month]} ${year} ${time}`;
    default:
      return readCategoryLabel(value);
  }
}

export function formatYAxisValue(value: unknown, format?: string): string {
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

function sortRowsByXAxis(rows: Record<string, unknown>[], xField: string) {
  return [...rows].sort((a, b) => {
    const av = getRowFieldValue(a, xField);
    const bv = getRowFieldValue(b, xField);
    const ad = parseDateValue(av);
    const bd = parseDateValue(bv);
    if (ad && bd) return ad.getTime() - bd.getTime();

    const an = readNumericValue(av);
    const bn = readNumericValue(bv);
    if (an != null && bn != null) return an - bn;

    return readCategoryLabel(av).localeCompare(readCategoryLabel(bv), undefined, { numeric: true });
  });
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

export default function LineChart({
  title,
  xAxis,
  xAxisColor,
  yAxis,
  yAxisColor,
  legend,
  lineType = "smooth",
  format,
  yAxisFormat,
  showDataPoints,
  xAxisIsDateTime = false,
  data = [],
}: LineChartProps) {
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

  const sortedData = useMemo(() => {
    if (!xAxis || data.length === 0) return data;
    return sortRowsByXAxis(data, xAxis);
  }, [data, xAxis]);

  const smooth = lineType !== "straight";
  const showSymbols = isTruthy(showDataPoints) || sortedData.length <= 24;
  const useDateFormat = xAxisIsDateTime && Boolean(format?.trim());

  const option = useMemo<EChartsOption>(() => {
    if (!ready) return { backgroundColor: "transparent" };

    const textColor = getThemeColor("--text", "#6b7280");
    const textHColor = getThemeColor("--text-h", "#111827");
    const borderColor = getThemeColor("--border", "#e5e7eb");

    if (!xAxis || yFields.length === 0 || sortedData.length === 0) {
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

    const categories = sortedData.map((row) => {
      const raw = getRowFieldValue(row, xAxis);
      return useDateFormat ? formatAxisValue(raw, format) : readCategoryLabel(raw);
    });
    const hasLegend = legendLabels.length > 1;
    const hasTitle = Boolean(title?.value);
    const titleFontSize = title?.valueFontSize ?? 14;
    const rotateLabels = categories.length > 12;
    // ECharts title component: top=6, internal padding 5px top+bottom, lineHeight≈fontSize×1.2
    // So title bottom ≈ 6 + 5 + fontSize×1.2 + 5 = fontSize×1.2 + 16
    // Add 8px breathing room before the grid starts
    const titleSpace = hasTitle ? Math.ceil(titleFontSize * 1.2 + 24) : 10;
    const legendTop = hasTitle ? Math.ceil(titleFontSize * 1.2 + 16) : 6;
    const gridTop = titleSpace + (hasLegend ? 28 : 0);

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
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: { color: borderColor, type: "dashed", width: 1 },
        },
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        borderRadius: 10,
        padding: [8, 14],
        textStyle: { color: textHColor, fontSize: 12 },
        extraCssText:
          "box-shadow: 0 4px 20px rgba(0,0,0,0.10); border-radius: 10px;",
        valueFormatter: (value) => formatYAxisValue(value, yAxisFormat),
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
        type: "category",
        data: categories,
        boundaryGap: false,
        axisLine: {
          show: true,
          lineStyle: { color: xAxisColor || borderColor, width: 1 },
        },
        axisTick: { show: false },
        axisLabel: {
          show: true,
          color: textColor,
          fontSize: 10,
          rotate: rotateLabels ? 35 : 0,
          hideOverlap: true,
          margin: rotateLabels ? 8 : 4,
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
          formatter: (value: number) => formatYAxisValue(value, yAxisFormat),
        },
        splitLine: {
          lineStyle: { color: borderColor, type: "dashed", width: 1, opacity: 0.7 },
        },
      },

      series: yFields.map((field, index) => ({
        name: legendLabels[index] || field,
        type: "line",
        smooth,
        symbol: "circle",
        symbolSize: showSymbols ? 5 : 1,
        showSymbol: showSymbols,
        connectNulls: false,
        itemStyle: {
          color: colors[index],
          borderWidth: 2,
          borderColor: "#ffffff",
        },
        lineStyle: { width: 2.5, color: colors[index] },
        emphasis: {
          focus: "series",
          itemStyle: { symbolSize: 8, borderWidth: 3, borderColor: "#ffffff" },
          lineStyle: { width: 3 },
        },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${colors[index]}${yFields.length === 1 ? "40" : "28"}` },
              { offset: 1, color: `${colors[index]}00` },
            ],
          },
        },
        data: sortedData.map((row) => readNumericValue(getRowFieldValue(row, field))),
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
    sortedData,
    format,
    useDateFormat,
    yAxisFormat,
    smooth,
    showSymbols,
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
