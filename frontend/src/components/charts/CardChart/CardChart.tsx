import { MdTrendingDown, MdTrendingFlat, MdTrendingUp } from "react-icons/md";

type ValueFormat = "currency" | "percentage" | "number" | "decimal";

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
  compareLabel?: string;
  compareFormat?: ValueFormat;
  targetBarColor?: string;
  valueFormat?: ValueFormat;
}

function fmt(v: number | string | null | undefined, f: ValueFormat): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return String(v);
  if (f === "currency")
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (f === "percentage") return `${(n * 100).toFixed(2)}%`;
  if (f === "number") return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (f === "decimal") return n.toFixed(2);
  return String(v);
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export default function CardChart({
  title,
  value,
  target,
  compare,
  compareLabel = "vs",
  compareFormat = "number",
  targetBarColor = "#eab308",
  valueFormat = "number",
}: CardChartProps) {
  const valNum = toNum(value?.value);
  const cmpNum = toNum(compare?.value);
  const tgtNum = toNum(target?.value);

  // delta % between main value and compare
  const delta =
    valNum !== null && cmpNum !== null && cmpNum !== 0
      ? ((valNum - cmpNum) / Math.abs(cmpNum)) * 100
      : null;

  // progress toward target
  const progress =
    valNum !== null && tgtNum !== null && tgtNum > 0
      ? Math.min(100, (valNum / tgtNum) * 100)
      : null;

  const isUp = delta !== null && delta >= 0;
  const trendColor = delta === null ? "#9ca3af" : isUp ? "#10b981" : "#ef4444";
  const trendBg = delta === null ? "#f3f4f6" : isUp ? "#d1fae5" : "#fee2e2";
  const TrendIcon = delta === null ? MdTrendingFlat : isUp ? MdTrendingUp : MdTrendingDown;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Accent strip */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l"
        style={{ background: targetBarColor }}
      />

      <div className="flex h-full flex-col gap-3 py-4 pl-5 pr-4">
        {/* ── Header ── */}
        <div className="flex shrink-0 items-start justify-between gap-2">
          {title?.value ? (
            <p
              className="truncate text-[11px] font-semibold uppercase tracking-widest"
              style={{
                color: title.valueFontColor ?? "#9ca3af",
                fontSize: title.valueFontSize ? `${title.valueFontSize}px` : undefined,
              }}
            >
              {String(title.value)}
            </p>
          ) : (
            <span />
          )}

          {delta !== null && (
            <div
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: trendBg, color: trendColor }}
            >
              <TrendIcon size={12} />
              {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>

        {/* ── Main value ── */}
        <div className="flex flex-1 flex-col justify-center gap-1">
          <p
            className="font-bold leading-none tracking-tight tabular-nums"
            style={{
              color: value?.valueFontColor ?? "#111827",
              fontSize: value?.valueFontSize
                ? `${value.valueFontSize}px`
                : "clamp(1.4rem, 5cqw, 2.25rem)",
            }}
          >
            {fmt(value?.value, valueFormat)}
          </p>

          {/* Compare sub-row */}
          {cmpNum !== null && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs" style={{ color: "#6b7280" }}>
                {compareLabel}
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#374151" }}>
                {fmt(cmpNum, compareFormat)}
              </span>
              {delta !== null && (
                <span
                  className="rounded px-1 py-px text-[10px] font-bold"
                  style={{ background: trendBg, color: trendColor }}
                >
                  {isUp ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Target progress ── */}
        {progress !== null && tgtNum !== null && (
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: "#6b7280" }}>
                Target · {fmt(tgtNum, valueFormat)}
              </span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: "#374151" }}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#e5e7eb" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: targetBarColor,
                  transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
