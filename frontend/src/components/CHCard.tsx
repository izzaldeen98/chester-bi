import { Lamp, type Signal } from "./Board";

interface CHCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  initials?: string;
  avatarBg?: string;
  badge?: {
    label: string;
    variant: "green" | "red" | "yellow" | "gray" | "blue";
  };
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

/* Columns shared with the BoardHead above the rows, so they can't drift.
   The leading avatar column exists only for people. */
export const CARD_COLS = "minmax(0,1fr) 150px 120px";
export const CARD_COLS_AVATAR = "32px minmax(0,1fr) 150px 120px";
const NARROW = "minmax(0,1fr) 100px";

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
        ["--cols" as string]: initials ? CARD_COLS_AVATAR : CARD_COLS,
        ["--cols-narrow" as string]: initials ? `28px ${NARROW}` : NARROW,
        borderBottom: "1px solid var(--border)",
        background: isSelected ? "var(--surface-2)" : undefined,
        boxShadow: isSelected ? "inset 2px 0 0 var(--accent)" : undefined,
      }}
    >
      {initials && (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium"
          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
        >
          {initials}
        </span>
      )}

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
