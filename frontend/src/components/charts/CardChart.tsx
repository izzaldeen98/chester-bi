import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTheme } from "../../lib/theme.jsx";

interface DataField {
  label?: string;
  value: number | null | undefined;
}

interface CardChartProps {
  title?: string;
  value?: DataField;
  target?: DataField;
  compare?: DataField;
  /** Fixed value font size in px. Falls back to responsive scaling when omitted. */
  valueSize?: number;
  /** Value text color. Defaults to theme `--text-h`. */
  valueColor?: string;
  /** Progress bar fill color. Defaults to theme `--accent` (green at 100% when omitted). */
  barColor?: string;
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

function formatCurrency(num: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function getThemeColor(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function scaleFont(base: number, width: number, height: number, min: number, max: number) {
  const factor = Math.min(width / 280, height / 160);
  return Math.round(Math.min(max, Math.max(min, base * factor)));
}

export default function CardChart({
  title,
  value,
  target,
  compare,
  valueSize: valueSizeProp,
  valueColor: valueColorProp,
  barColor: barColorProp,
}: CardChartProps) {
  const { theme } = useTheme();
  const { ref, width, height } = useContainerSize();
  const ready = width > 0 && height > 0;

  const option = useMemo<EChartsOption>(() => {
    if (!ready) return { backgroundColor: "transparent" };

    const textColor = getThemeColor("--text", "#6b7280");
    const textHColor = getThemeColor("--text-h", "#111827");
    const borderColor = getThemeColor("--border", "#e5e7eb");
    const accentColor = getThemeColor("--accent", "#eab308");

    const labelSize = scaleFont(13, width, height, 18, 30);
    const valueSize = valueSizeProp ?? scaleFont(32, width, height, 16, 40);
    const valueColor = valueColorProp ?? textHColor;
    const detailSize = scaleFont(12, width, height, 9, 13);
    const compareSize = scaleFont(13, width, height, 9, 14);

    const labelY = Math.round(height * 0.05);
    const valueY = Math.round(height * 0.20);
    const detailY = Math.round(height * 0.45);
    const barY = Math.round(height * 0.60);
    const compareY = Math.round(height * 0.75);

    const barHeight = Math.max(4, Math.round(height * 0.05));
    const barWidth = width;
    const showTarget = target?.value != null;
    const showValue = value?.value != null;
    const showCompare = compare?.value != null;
    const compact = height < 120;

    const graphic: NonNullable<EChartsOption["graphic"]> = [];

    if (value?.label) {
      graphic.push({
        type: "text",
        left: 0,
        top: labelY,
        style: {
          text: value.label,
          fill: textColor,
          fontSize: labelSize,
          fontWeight: 500,
        },
      });
    }

    if (showValue) {
      graphic.push({
        type: "text",
        left: 0,
        top: valueY,
        style: {
          text: formatCurrency(value?.value ?? 0),
          fill: valueColor,
          fontSize: valueSize,
          fontWeight: 700,
        },
      });
    }

    if (showTarget && !compact) {
      const targetValue = target?.value ?? 0;
      graphic.push({
        type: "text",
        left: 0,
        top: detailY,
        style: {
          text: `Target: ${formatCurrency(targetValue)}`,
          fill: textColor,
          fontSize: detailSize,
        },
      });

      if (showValue && targetValue > 0) {
        const targetPercent = Math.min(((value?.value ?? 0) / targetValue) * 100, 100);
        const filledWidth = (barWidth * targetPercent) / 100;
        const barFillColor = barColorProp
          ? barColorProp
          : targetPercent >= 100
            ? "#10b981"
            : accentColor;

        graphic.push(
          {
            type: "text",
            right: 0,
            top: detailY,
            style: {
              text: `${targetPercent.toFixed(1)}%`,
              fill: textHColor,
              fontSize: detailSize,
              fontWeight: 600,
            },
          },
          {
            type: "rect",
            left: 0,
            top: barY,
            shape: { width: barWidth, height: barHeight, r: barHeight / 2 },
            style: { fill: borderColor },
          },
          {
            type: "rect",
            left: 0,
            top: barY,
            shape: { width: filledWidth, height: barHeight, r: barHeight / 2 },
            style: { fill: barFillColor },
          },
        );
      }
    }

    if (showCompare && !compact) {
      const compareValue = compare?.value ?? 0;
      const isPositive = compareValue >= 0;
      graphic.push({
        type: "text",
        left: 0,
        top: showTarget && !compact ? compareY : detailY,
        style: {
          text: `${isPositive ? "▲" : "▼"} ${Math.abs(compareValue).toFixed(1)}% vs compare`,
          fill: isPositive ? "#16a34a" : "#dc2626",
          fontSize: compareSize,
          fontWeight: 600,
        },
      });
    }

    return {
      backgroundColor: "transparent",
      graphic,
    };
  }, [ready, width, height, value, target, compare, theme, valueSizeProp, valueColorProp, barColorProp]);

  return (
    <div className="flex h-full w-full min-h-0 flex-col p-1">
      {title && (
        <p
          className="shrink-0 truncate px-1 text-center text-xs font-semibold leading-tight text-left"
          style={{ color: "var(--text-h)" }}
        >
          {title}
        </p>
      )}
      <div ref={ref} className="min-h-0 flex-1">
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
