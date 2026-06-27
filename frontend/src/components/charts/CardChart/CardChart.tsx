import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface DataField {
  label?: string;
  value: number | string | null | undefined;
  valueFontSize?: number;
  valueFontColor?: string;
}

interface CardChartProps {
  title?: DataField;
  value?: DataField;
  target?: DataField;  
  compare?: DataField; 
  targetBarColor?: string;
  valueFormat?: ValueFormat;
}

type ValueFormat = "currency" | "percentage" | "number" | "decimal";

function valueFormatter(value: number | string | null | undefined, format: ValueFormat) {
  if (value === null || value === undefined) return "—";
  
  const numericValue = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(numericValue)) return String(value);

  if (format === "currency") return `$${numericValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (format === "percentage") return `${numericValue.toFixed(2)}%`;
  if (format === "number") return numericValue.toFixed(0);
  if (format === "decimal") return numericValue.toFixed(2);
  
  return String(value);
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

export default function CardChart({
  title,
  value,
  target,
  compare,
  targetBarColor = "#eab308",
  valueFormat = "number",
}: CardChartProps) {
  const { ref, width, height } = useContainerSize();
  const ready = width > 0 && height > 0;

  const option = useMemo<EChartsOption>(() => {
    if (!ready) return { backgroundColor: "transparent" };

    const graphics: NonNullable<EChartsOption["graphic"]> = [];
    
    // ENHANCEMENT 1: Determine safe proportional bounds using height & width scales
    const scaleFactor = Math.min(width / 300, height / 180);
    const elementGap = Math.max(4, Math.round(height * 0.04)); // Dynamic gap space (4% of canvas height)
    
    let startingTop = Math.max(2, Math.round(height * 0.02)); // Initial padding roof gap

    if (title?.value) {
      // Scale font based on screen dimensions, keeping boundaries safe
      const computedTitleSize = title.valueFontSize ?? Math.round(Math.min(26, Math.max(12, 18 * scaleFactor)));

      graphics.push({
        type: "text",
        left: 2,
        top: startingTop,
        style: {
          text: title.value as string,
          fontSize: computedTitleSize, 
          fill: title.valueFontColor ?? "#111827", 
          fontWeight: "bold",
          textVerticalAlign: "top", 
        }
      });
      startingTop += computedTitleSize + elementGap;
    }

    if (value) {
      if (value.label) {
        const computedLabelSize = Math.round(Math.min(16, Math.max(10, 12 * scaleFactor)));
        graphics.push({
          type: "text",
          left: 2,
          top: startingTop, 
          style: {
            text: value.label,
            fontSize: computedLabelSize,
            fill: "#6b7280",
            textVerticalAlign: "top", 
          }
        });
        startingTop += computedLabelSize + Math.round(elementGap * 0.5); 
      }

      if (value.value != null) {
        const computedValueSize = value.valueFontSize ?? Math.round(Math.min(42, Math.max(16, 28 * scaleFactor)));
        graphics.push({
          type: "text",
          left: 2,
          top: startingTop, 
          style: {
            text: valueFormatter(value.value, valueFormat), 
            fontSize: computedValueSize,
            fontWeight: "bold",
            fill: value.valueFontColor ?? "#111827",
            textVerticalAlign: "top", 
          }
        });
        startingTop += computedValueSize + elementGap;
      }
    }

    if (target && target.value != null) {
      const computedTargetSize = target.valueFontSize ?? Math.round(Math.min(18, Math.max(11, 13 * scaleFactor)));
      
      graphics.push({
        type: "text",
        left: 2,
        top: startingTop,
        style: {
          text: `Target: ${valueFormatter(target.value, "currency")}`,
          fontSize: computedTargetSize,
          fill: target.valueFontColor ?? "#4b5563",
          fontWeight: "600",
          textVerticalAlign: "top", 
        }
      });

      startingTop += computedTargetSize + Math.round(elementGap * 0.7);
      
      // ENHANCEMENT 2: Dynamic Progress Bar sizes calculated relative to element sizing constraints
      const currentNum = typeof value?.value === "number" ? value.value : parseFloat(String(value?.value ?? 0));
      const targetNum = typeof target.value === "number" ? target.value : parseFloat(String(target.value ?? 0));
      const calculatedPct = targetNum > 0 ? (targetNum / currentNum) * 100 : 0;
      const percentageString = calculatedPct.toFixed(1);
      
      const availableWidth = Math.max(0, width - 4);
      const fillPercent = Math.min(Math.max(calculatedPct, 0), 100);
      const filledWidth = (availableWidth * fillPercent) / 100;
      
      const barHeight = Math.min(12, Math.max(4, Math.round(height * 0.045))); // Height adjusts seamlessly to scaling changes
      const borderRadius = barHeight / 2;

      graphics.push(
        {
          type: "rect",
          left: 2,
          top: startingTop,
          shape: {
            width: availableWidth,
            height: barHeight,
            r: borderRadius
          },
          style: { fill: "#e5e7eb" }
        },
        {
          type: "rect",
          left: 2,
          top: startingTop,
          shape: {
            width: filledWidth,
            height: barHeight,
            r: borderRadius
          },
          style: { fill: targetBarColor }
        }
      );

      startingTop += barHeight + Math.round(elementGap * 0.5);

      // ENHANCEMENT 3: Percentage tag follows the filled progress bar boundary line safely
      const computedPctSize = Math.round(Math.min(14, Math.max(9, 10 * scaleFactor)));
      const estimatedTextWidth = computedPctSize * 3.5;
      let textLeftPosition = filledWidth - (estimatedTextWidth / 2);
      if (textLeftPosition < 2) textLeftPosition = 2;
      if (textLeftPosition + estimatedTextWidth > availableWidth) {
        textLeftPosition = availableWidth - estimatedTextWidth;
      }

      graphics.push({
        type: "text",
        left: textLeftPosition,
        top: startingTop,
        style: {
          text: `${percentageString}%`,
          fontSize: computedPctSize,
          fill: "#374151",
          fontWeight: "bold",
          textVerticalAlign: "top", 
        }
      });
      startingTop += computedPctSize + elementGap;
    }

    if (compare && compare.value != null) {
      const computedCompareSize = Math.round(Math.min(16, Math.max(10, 11 * scaleFactor)));
      graphics.push({
        type: "text",
        left: 2,
        top: startingTop,
        style: {
          text: `Compare: ${valueFormatter(compare.value, "currency")}`,
          fontSize: computedCompareSize,
          fill: "#6b7280",
          textVerticalAlign: "top"
        }
      });
    }

    return {
      backgroundColor: "transparent",
      graphic: graphics,
    };
  }, [ready, width, height, title, value, target, compare, targetBarColor, valueFormat]);

  return (
    // The wrapper elements use full dimensions to instantly expand and conform to their grid parent containers
    <div className="w-full h-full min-h-0 min-w-0 flex flex-col">
      <div ref={ref} className="w-full h-full min-h-0 min-w-0 flex-1">
        {ready && (
          <ReactECharts
            option={option}
            style={{ width: "100%", height: "100%" }} 
            notMerge
            lazyUpdate
          />
        )}
      </div>
    </div>
  );
}
