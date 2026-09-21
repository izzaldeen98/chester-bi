import { Lamp, type Signal } from "./Board";

interface CHCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  initials: string;
  avatarBg?: string;
  badge?: {
    label: string;
    variant: "green" | "red" | "yellow" | "gray" | "blue";
  };
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

/* Was a card in a grid; now a row on the board. Same props, so every page
   that lists things gets the board grammar without changing its logic.
   Columns: reference · name · type · state. They never move. */
const SIGNAL: Record<string, Signal> = {
  green: "ok",
  red: "fail",
  yellow: "live",
  blue: "idle",
  gray: "idle",
};

const SIGNAL_INK: Record<Signal, string> = {
  ok: "var(--ok)",
  fail: "var(--danger)",
  live: "var(--accent)",
  idle: "var(--text-3)",
};

export default function CHCard({
  title,
  subtitle,
  meta,
  initials,
  badge,
  isSelected = false,
  onClick,
  className = "",
}: CHCardProps) {
  const signal: Signal = badge ? SIGNAL[badge.variant] ?? "idle" : "idle";
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`settle-row list-grid grid items-center gap-4 px-4 py-3 transition-colors ${
        onClick ? "cursor-pointer hover:bg-[var(--surface-2)]" : ""
      } ${className}`}
      style={{
        ["--cols" as string]: "44px minmax(0,1fr) 150px 120px",
        ["--cols-narrow" as string]: "36px minmax(0,1fr) 100px",
        borderBottom: "1px solid var(--border)",
        background: isSelected ? "var(--surface-2)" : undefined,
        boxShadow: isSelected ? "inset 2px 0 0 var(--accent)" : undefined,
      }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center text-[11px] font-medium"
        style={{ background: "var(--surface-2)", color: "var(--text-2)", borderRadius: "var(--r-sm)" }}
      >
        {initials}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium leading-tight" style={{ color: "var(--text)" }}>{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[12px] leading-tight" style={{ color: "var(--text-3)" }}>
            {subtitle}
          </span>
        )}
      </span>

      <span className="col-secondary truncate text-[12.5px]" style={{ color: "var(--text-3)" }}>
        {meta ?? ""}
      </span>

      <span className="flex items-center justify-end gap-2">
        {badge && (
          <>
            <Lamp signal={signal} />
            <span className="text-[12.5px]" style={{ color: SIGNAL_INK[signal] }}>
              {badge.label}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
