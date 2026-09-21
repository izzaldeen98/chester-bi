/* ─────────────────────────────────────────────────────────────────────────
   SURFACE PRIMITIVES

   Quiet containers, one hairline border, restrained depth. Content leads;
   the chrome around it should be almost unnoticeable.

   The file keeps its name so existing imports resolve; the vocabulary is
   Panel / ListHead / Row / EmptyState / Stat / Dot / StatusText.
   ───────────────────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";

export type Signal = "ok" | "live" | "fail" | "idle";

const SIGNAL_COLOR: Record<Signal, string> = {
  ok: "var(--ok)",
  live: "var(--accent)",
  fail: "var(--danger)",
  idle: "var(--text-3)",
};

/* ── Dot ───────────────────────────────────────────────────────────────
   State reads as a small coloured dot plus a word. No pill, no badge. */
export function Lamp({ signal, live = false }: { signal: Signal; live?: boolean }) {
  return (
    <span
      aria-hidden
      className={live ? "animate-pulse" : undefined}
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 99,
        background: SIGNAL_COLOR[signal],
        flexShrink: 0,
      }}
    />
  );
}

export function Status({
  signal,
  children,
  live = false,
}: {
  signal: Signal;
  children: string;
  live?: boolean;
  cascade?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: SIGNAL_COLOR[signal] }}>
      <Lamp signal={signal} live={live} />
      {children}
    </span>
  );
}

/* Kept so older call sites resolve; renders plain text. */
export function Flap({ children }: { children: string; cascade?: boolean }) {
  return <>{children}</>;
}

/* ── Panel ─────────────────────────────────────────────────────────────
   A white surface on the page ground. The header is optional and quiet —
   a title, maybe one action. No tinted bar, no uppercase eyebrow. */
export function Panel({
  label,
  action,
  children,
  className = "",
  bodyClassName = "",
  flush = false,
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <section
      className={`settle flex min-h-0 flex-col overflow-hidden ${className}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {(label || action) && (
        <header
          className="flex shrink-0 items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {label && (
            <h2 className="text-[14px] font-medium" style={{ color: "var(--text)" }}>
              {label}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">{action}</div>
        </header>
      )}
      <div className={`${flush ? "" : "p-4"} min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ── List ──────────────────────────────────────────────────────────────
   Columns are declared once and shared by the head and every row. */
export function BoardHead({
  cols,
  colsNarrow,
  children,
}: {
  cols: string;
  colsNarrow?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="list-grid grid items-center gap-4 px-4 py-2"
      style={{
        ["--cols" as string]: cols,
        ["--cols-narrow" as string]: colsNarrow ?? cols,
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}
    >
      {children}
    </div>
  );
}

export function BoardRow({
  cols,
  colsNarrow,
  children,
  onClick,
  selected = false,
  className = "",
}: {
  cols: string;
  colsNarrow?: string;
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  const interactive = Boolean(onClick);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`settle-row list-grid group grid items-center gap-4 px-4 py-3 transition-colors ${
        interactive ? "cursor-pointer hover:bg-[var(--surface-2)]" : ""
      } ${className}`}
      style={{
        ["--cols" as string]: cols,
        ["--cols-narrow" as string]: colsNarrow ?? cols,
        borderBottom: "1px solid var(--border)",
        background: selected ? "var(--surface-2)" : undefined,
        boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

/* Panels size to their content now, so no filler is needed. */
export function BoardFill() {
  return null;
}

/* ── Empty state ───────────────────────────────────────────────────────
   Always carries the way forward; measured grid behind it so the space
   reads as prepared rather than abandoned. */
export function EmptyBoard({
  line,
  hint,
  action,
}: {
  line: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div aria-hidden className="grid-paper pointer-events-none absolute inset-0" />
      <p className="relative text-[15px] font-medium" style={{ color: "var(--text)" }}>
        {line}
      </p>
      {hint && (
        <p className="relative mt-1.5 max-w-[46ch] text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          {hint}
        </p>
      )}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

/* ── Stat ──────────────────────────────────────────────────────────────
   A figure and what it counts. No tile, no icon chip, no trend arrow. */
export function Readout({
  value,
  label,
  signal,
  onClick,
}: {
  value: string | number;
  label: string;
  signal?: Signal;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span
        className="tnum block text-[26px] font-semibold leading-none tracking-[-0.03em]"
        style={{ color: signal ? SIGNAL_COLOR[signal] : "var(--text)" }}
      >
        {value}
      </span>
      <span className="label mt-1.5 block">{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block rounded-[var(--r)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        {body}
      </button>
    );
  }
  return <div className="px-3 py-2.5">{body}</div>;
}
