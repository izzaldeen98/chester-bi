import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getRowFieldValue } from "../../lib/queryResult";
import { formatYAxisValue } from "./LineChart";

interface TitleField {
  value: string;
  valueFontSize?: number;
  valueFontColor?: string;
}

export interface TreemapChartProps {
  title?: TitleField;
  category?: string;
  value?: string;
  valueFormat?: string;
  tileColor?: string | string[];
  showValue?: string | boolean;
  data?: Record<string, unknown>[];
}

// Validated categorical palette (fixed hue order, CVD-checked) — see dataviz skill.
const TILE_COLORS_LIGHT = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948",
];
const TILE_COLORS_DARK = [
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

export default function TreemapChart({
  title,
  category,
  value,
  valueFormat,
  tileColor,
  showValue = "true",
  data = [],
}: TreemapChartProps) {
  const { ref, width, height } = useContainerSize();
  const ready = width > 0 && height > 0;

  const colors = useMemo(() => parseList(tileColor), [tileColor]);
  const showVal = isTruthy(showValue);

  const option = useMemo<EChartsOption>(() => {
    if (!ready) return { backgroundColor: "transparent" };

    const textColor = getThemeColor("--text", "#6b7280");
    const textHColor = getThemeColor("--text-h", "#111827");
    const surfaceColor = getThemeColor("--bg", "#ffffff");

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

    const palette = isDarkMode() ? TILE_COLORS_DARK : TILE_COLORS_LIGHT;
    const tiles = data
      .map((row, index) => {
        const tileValue = readNumericValue(getRowFieldValue(row, value));
        if (tileValue == null) return null;
        const name = readCategoryLabel(getRowFieldValue(row, category)) || `Item ${index + 1}`;
        return {
          name,
          value: tileValue,
          itemStyle: {
            color: colors[index] || palette[index % palette.length],
          },
        };
      })
      .filter((tile): tile is NonNullable<typeof tile> => tile != null)
      .sort((a, b) => b.value - a.value);

    if (tiles.length === 0) {
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

    const hasTitle = Boolean(title?.value);
    const titleFontSize = title?.valueFontSize ?? 14;

    return {
      backgroundColor: "transparent",

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
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        borderRadius: 10,
        padding: [8, 14],
        textStyle: { color: textHColor, fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 20px rgba(0,0,0,0.10); border-radius: 10px;",
        formatter: (params: any) =>
          `${params.name}: ${formatYAxisValue(params.value, valueFormat)}`,
      },

      series: [
        {
          type: "treemap",
          top: hasTitle ? Math.ceil(titleFontSize * 1.2 + 24) : 8,
          left: 4,
          right: 4,
          bottom: 4,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          itemStyle: {
            borderColor: surfaceColor,
            borderWidth: 2,
            gapWidth: 2,
          },
          label: {
            show: true,
            color: "#ffffff",
            fontSize: 11,
            fontWeight: 600,
            overflow: "truncate" as const,
            formatter: (params: { name?: string; value?: unknown }) =>
              showVal ? `${params.name}\n${formatYAxisValue(params.value, valueFormat)}` : `${params.name}`,
          },
          upperLabel: { show: false },
          data: tiles,
        },
      ],
    };
  }, [ready, title, category, value, valueFormat, colors, showVal, data]);

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