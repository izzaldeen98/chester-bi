import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MdDragIndicator,
  MdClose,
  MdEdit,
  MdCheck,
  MdSwapHoriz,
  MdSwapVert,
  MdExpandMore,
} from "react-icons/md";
import {
  type FilterRule,
  type FilterKind,
  type FilterMapping,
  type FilterUIType,
  type AvailableChart,
  opsForKind,
  NO_VALUE_OPS,
  useDistinctFieldValues,
  useFieldRange,
} from "./FilterEditDialog";
import FilterEditDialog from "./FilterEditDialog";

// ── Shared field styling — every control fills its row, never a fixed box ──

const fieldCls =
  "h-8 w-full min-w-0 flex-1 rounded-lg border text-[12px] font-medium px-2.5 outline-none transition-all " +
  "duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";
const fieldSty = {
  borderColor: "var(--border-muted, var(--border))",
  background: "var(--bg-card, var(--bg))",
  color: "var(--text-h)",
} as const;

const DATE_UNITS = ["days", "weeks", "months", "years"] as const;

function SelectCaret() {
  return (
    <MdExpandMore
      size={15}
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-50"
      style={{ color: "var(--text-h)" }}
    />
  );
}

// ── Distinct-value single select ────────────────────────────────────────────

function CompactValueDropdown({
  mapping,
  value,
  onChange,
}: {
  mapping: FilterMapping;
  value: string;
  onChange: (v: string) => void;
}) {
  const { values, loading, error } = useDistinctFieldValues(mapping, true);

  if (error) {
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Value…" className={fieldCls} style={fieldSty} />
    );
  }

  return (
    <div className="relative w-full min-w-0 flex-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className={`${fieldCls} cursor-pointer appearance-none pr-7`}
        style={fieldSty}
      >
        <option value="">{loading ? "Loading…" : "Select a value…"}</option>
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <SelectCaret />
    </div>
  );
}

// ── Multi-select: expanded list, or a collapsed dropdown around the same list ─

function CompactMultiSelectPicker({
  mapping,
  value,
  onChange,
  style,
}: {
  mapping: FilterMapping;
  value: string;
  onChange: (v: string) => void;
  style: "dropdown" | "list";
}) {
  const { values, loading, error } = useDistinctFieldValues(mapping, true);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];

  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next.join(","));
  };

  // The widget itself clips overflow, so a normally-positioned popover gets cut off
  // wherever the widget's box ends. Render it into a portal, positioned via the
  // button's viewport rect, so it always draws on top and is fully reachable.
  useEffect(() => {
    if (!open || style !== "dropdown") return;
    const updatePos = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
    };
    updatePos();
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, style]);

  useEffect(() => {
    if (!open || style !== "dropdown") return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, style]);

  if (error) {
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="value1, value2, …" className={fieldCls} style={fieldSty} />
    );
  }

  const list = (
    <div className="flex max-h-48 w-full min-w-0 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1 shadow-lg"
      style={{ borderColor: "var(--border)", background: "var(--bg-card, var(--bg))" }}>
      {loading && (
        <p className="px-2 py-1.5 text-[11px] opacity-70" style={{ color: "var(--text)" }}>Loading…</p>
      )}
      {!loading && values.length === 0 && (
        <p className="px-2 py-1.5 text-[11px] opacity-70" style={{ color: "var(--text)" }}>No values found.</p>
      )}
      {!loading && values.map((v) => {
        const checked = selected.includes(v);
        return (
          <label key={v}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
              checked ? "bg-[var(--accent-muted)]" : "hover:bg-[var(--border)]"
            }`}
          >
            <input type="checkbox" checked={checked} onChange={() => toggle(v)}
              className="h-3.5 w-3.5 accent-[var(--accent)]" />
            <span className="truncate" style={{ color: checked ? "var(--accent)" : "var(--text-h)" }}>{v}</span>
          </label>
        );
      })}
    </div>
  );

  if (style === "list") return list;

  return (
    <div className="relative w-full min-w-0 flex-1">
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)}
        className={`${fieldCls} flex cursor-pointer items-center justify-between gap-1.5 text-left`} style={fieldSty}>
        <span className="truncate">
          {loading ? "Loading…" : selected.length ? `${selected.length} selected` : "Select values…"}
        </span>
        <MdExpandMore size={15} className="shrink-0 opacity-50" />
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
          {list}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── Range slicer ─────────────────────────────────────────────────────────

function sliderFromEpoch(ms: number, kind: FilterKind): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (kind === "date") return dateStr;
  return `${dateStr} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function CompactSlicerPicker({
  mapping,
  kind,
  value,
  onChange,
}: {
  mapping: FilterMapping;
  kind: FilterKind;
  value: string;
  onChange: (v: string) => void;
}) {
  const { range, loading, error } = useFieldRange(mapping, true);

  if (error) {
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="min,max" className={fieldCls} style={fieldSty} />
    );
  }
  if (loading || !range) {
    return (
      <div className={`${fieldCls} flex items-center text-[11px] opacity-70`} style={fieldSty}>Loading range…</div>
    );
  }

  const isDate = kind === "date" || kind === "datetime";
  const toNum = (v: string): number | null => {
    if (!v) return null;
    if (isDate) { const d = new Date(v); return isNaN(d.getTime()) ? null : d.getTime(); }
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const fromNum = (n: number) => (isDate ? sliderFromEpoch(n, kind) : String(Math.round(n * 100) / 100));

  const [rawA, rawB] = value ? value.split(",") : ["", ""];
  const curMin = toNum(rawA) ?? range.min;
  const curMax = toNum(rawB) ?? range.max;
  const span = range.max - range.min;
  const step = isDate ? 3600 * 1000 : (span > 0 ? span / 200 : 1);

  const setMin = (n: number) => onChange(`${fromNum(Math.min(n, curMax))},${fromNum(curMax)}`);
  const setMax = (n: number) => onChange(`${fromNum(curMin)},${fromNum(Math.max(n, curMin))}`);
  const pct = (n: number) => (span > 0 ? ((n - range.min) / span) * 100 : 0);

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1">
      <div className="relative h-4 w-full">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: "var(--border)" }} />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: "var(--accent)", left: `${pct(curMin)}%`, right: `${100 - pct(curMax)}%` }} />
        <input type="range" min={range.min} max={range.max} step={step} value={curMin}
          onChange={(e) => setMin(Number(e.target.value))}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent" />
        <input type="range" min={range.min} max={range.max} step={step} value={curMax}
          onChange={(e) => setMax(Number(e.target.value))}
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent" />
      </div>
      <div className="flex items-center justify-between text-[10px] font-medium opacity-80" style={{ color: "var(--text-h)" }}>
        <span>{fromNum(curMin)}</span>
        <span>{fromNum(curMax)}</span>
      </div>
    </div>
  );
}

// ── Plain input / date / number editors, all width-filling ─────────────────

function CompactValueEditor({
  kind,
  operator,
  value,
  onChange,
  mapping,
  uiType = "input",
  multiSelectStyle = "list",
}: {
  kind: FilterKind;
  operator: string;
  value: string;
  onChange: (v: string) => void;
  mapping?: FilterMapping;
  uiType?: FilterUIType;
  multiSelectStyle?: "dropdown" | "list";
}) {
  if (uiType === "slicer" && mapping && kind !== "text") {
    return <CompactSlicerPicker mapping={mapping} kind={kind} value={value} onChange={onChange} />;
  }
  if (uiType === "multiselect" && mapping) {
    return <CompactMultiSelectPicker mapping={mapping} value={value} onChange={onChange} style={multiSelectStyle} />;
  }
  if (uiType === "select" && mapping) {
    return <CompactValueDropdown mapping={mapping} value={value} onChange={onChange} />;
  }

  const isDate = kind === "datetime" || kind === "date";
  const inputType =
    kind === "datetime" ? "datetime-local"
    : kind === "date"   ? "date"
    : kind === "number" ? "number"
    : "text";

  // last / next  →  [n] [unit ▼]
  if (isDate && ["last", "next"].includes(operator)) {
    const [amt = "1", unit = "days"] = value ? value.split(":") : [];
    return (
      <div className="flex w-full min-w-0 flex-1 items-center gap-1.5">
        <input type="number" min={1} value={amt}
          onChange={(e) => onChange(`${e.target.value}:${unit}`)}
          className={`${fieldCls} basis-1/3`} style={fieldSty} />
        <div className="relative w-full min-w-0 flex-1">
          <select value={unit} onChange={(e) => onChange(`${amt}:${e.target.value}`)}
            className={`${fieldCls} cursor-pointer appearance-none pr-7`} style={fieldSty}>
            {DATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <SelectCaret />
        </div>
      </div>
    );
  }

  // after / before  →  absolute date, or relative [n][unit]
  if (isDate && ["after", "before"].includes(operator)) {
    const isAbsolute = value.startsWith("absolute|");
    const isRelative = value.startsWith("relative|") || (!isAbsolute && !value.startsWith("absolute"));

    if (isAbsolute) {
      const abs = value.slice(9);
      return (
        <input type={inputType} value={abs}
          onChange={(e) => onChange(`absolute|${e.target.value}`)}
          className={fieldCls} style={fieldSty} />
      );
    }

    const [, unit = "days", amt = "1"] = isRelative ? value.split("|") : ["relative", "days", "1"];
    return (
      <div className="flex w-full min-w-0 flex-1 items-center gap-1.5">
        <input type="number" min={1} value={amt}
          onChange={(e) => onChange(`relative|${unit}|${e.target.value}`)}
          className={`${fieldCls} basis-1/3`} style={fieldSty} />
        <div className="relative w-full min-w-0 flex-1">
          <select value={unit} onChange={(e) => onChange(`relative|${e.target.value}|${amt}`)}
            className={`${fieldCls} cursor-pointer appearance-none pr-7`} style={fieldSty}>
            {DATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <SelectCaret />
        </div>
      </div>
    );
  }

  // between / not between  →  [from] – [to]
  if (["between", "not between"].includes(operator)) {
    const [a = "", b = ""] = value ? value.split(",") : [];
    return (
      <div className="flex w-full min-w-0 flex-1 items-center gap-1.5">
        <input type={inputType} value={a}
          onChange={(e) => onChange(`${e.target.value},${b}`)}
          placeholder="From" className={fieldCls} style={fieldSty} />
        <span className="shrink-0 text-[10px] font-medium opacity-50" style={{ color: "var(--text)" }}>to</span>
        <input type={inputType} value={b}
          onChange={(e) => onChange(`${a},${e.target.value}`)}
          placeholder="To" className={fieldCls} style={fieldSty} />
      </div>
    );
  }

  // single value
  return (
    <input type={inputType} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value…"
      className={fieldCls} style={fieldSty} />
  );
}

// ── Props ─────────────────────────────────────────────────────────────────

interface DashboardFilterWidgetProps {
  rule: FilterRule;
  readOnly?: boolean;
  availableCharts?: AvailableChart[];
  onChange?: (rule: FilterRule) => void;
  onDelete?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function DashboardFilterWidget({
  rule,
  readOnly = false,
  availableCharts = [],
  onChange,
  onDelete,
}: DashboardFilterWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);

  // Changes to value update localRule only; onChange (which triggers chart
  // re-queries) fires only when Apply is clicked.
  const [localRule, setLocalRule] = useState(rule);
  useEffect(() => { setLocalRule(rule); }, [rule]);

  const isDirty = JSON.stringify(localRule) !== JSON.stringify(rule);
  const handleApply = () => onChange?.(localRule);
  const vertical = localRule.orientation === "vertical";
  const toggleOrientation = () => {
    const next = { ...localRule, orientation: (vertical ? "horizontal" : "vertical") as "horizontal" | "vertical" };
    setLocalRule(next);
    onChange?.(next);
  };

  // Title is metadata, not a query input — commit it straight onto the parent's
  // rule (not the possibly-dirty localRule draft) so it never bypasses Apply.
  const commitTitle = (title: string) => {
    const clean = title.trim() || localRule.mappings[0]?.fieldName || "Filter";
    setLocalRule((prev) => ({ ...prev, label: clean }));
    onChange?.({ ...rule, label: clean });
  };

  const ops        = opsForKind(localRule.kind);
  const noValue    = NO_VALUE_OPS.includes(localRule.operator);
  const opLabel    = ops.find((o) => o.value === localRule.operator)?.label ?? localRule.operator;
  const fieldLabel = localRule.label || localRule.mappings[0]?.fieldName || "Filter";
  const showOperator = !localRule.uiType || localRule.uiType === "input";

  const isWorkspace = onDelete !== undefined;

  // Only rendered while dirty (see call sites below), so it's always the "active" style.
  const ApplyButton = isDirty && (
    <button
      type="button"
      onClick={handleApply}
      title="Apply filter"
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-all duration-150"
      style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12)", cursor: "pointer" }}
    >
      <MdCheck size={13} />
      Apply
    </button>
  );

  const operatorBadge = showOperator && (
    <span
      className="flex h-7 shrink-0 items-center rounded-md border px-2 text-[10px] font-medium"
      style={{ borderColor: "var(--border-muted, var(--border))", background: "var(--bg-subtle, var(--bg))", color: "var(--text-h)" }}
    >
      {opLabel}
    </span>
  );

  const titleSpan = (
    <span
      className="min-w-0 flex-1 truncate text-[11px] font-semibold"
      style={{ color: "var(--text-h)" }}
      title={fieldLabel}
    >
      {fieldLabel}
    </span>
  );

  const valueArea = readOnly ? (
    <>
      {showOperator && (
        <span className="shrink-0 text-[11px] font-medium opacity-70" style={{ color: "var(--text-h)" }}>{opLabel}</span>
      )}
      {!noValue && localRule.value && (
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold" style={{ color: "var(--text-h)" }} title={localRule.value}>
          {localRule.value}
        </span>
      )}
      {!noValue && !localRule.value && (
        <span className="text-[11px] italic opacity-50" style={{ color: "var(--text)" }}>any</span>
      )}
    </>
  ) : (
    <>
      {operatorBadge}
      {!noValue ? (
        <CompactValueEditor
          kind={localRule.kind}
          operator={localRule.operator}
          value={localRule.value}
          onChange={(v) => setLocalRule({ ...localRule, value: v })}
          mapping={localRule.mappings[0]}
          uiType={localRule.uiType}
          multiSelectStyle={localRule.multiSelectStyle}
        />
      ) : (
        <div className="min-w-0 flex-1" />
      )}
    </>
  );

  /* ─────────────────────────────────────────────────────────────────────────
     VIEW MODE  –  title always sits in a thin row on top; the controls row
     below follows the orientation toggle (row for horizontal, stacked for
     vertical).
  ───────────────────────────────────────────────────────────────────────── */
  if (!isWorkspace) {
    return (
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow duration-150 hover:shadow-md"
        style={{ borderColor: isDirty ? "var(--accent)" : "var(--border)", background: "var(--bg-card, var(--bg))" }}
      >
        <div className="flex w-full shrink-0 items-center gap-2 select-none px-2.5 py-1">
          {titleSpan}
          {!readOnly && ApplyButton}
        </div>
        <span className="mx-2.5 h-px shrink-0" style={{ background: "var(--border)", opacity: 0.5 }} />
        <div className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 ${vertical ? "flex-col items-stretch" : "flex-row"}`}>
          {valueArea}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     WORKSPACE MODE  –  drag handle + title always sit in a thin row on top;
     the controls row below follows the orientation toggle (row for
     horizontal, stacked for vertical).
  ───────────────────────────────────────────────────────────────────────── */
  const actionButtons = (
    <div className="flex shrink-0 items-center gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
      <button type="button" onClick={toggleOrientation}
        className="rounded-md p-1.5 transition-colors hover:bg-[var(--border)]"
        title={vertical ? "Switch to horizontal layout" : "Switch to vertical layout"}>
        {vertical ? <MdSwapHoriz size={14} style={{ color: "var(--text)" }} /> : <MdSwapVert size={14} style={{ color: "var(--text)" }} />}
      </button>
      <button type="button" onClick={() => setEditOpen(true)}
        className="rounded-md p-1.5 transition-colors hover:bg-[var(--border)]" title="Edit filter">
        <MdEdit size={13} style={{ color: "var(--text)" }} />
      </button>
      <button type="button" onClick={() => onDelete?.()}
        className="rounded-md p-1.5 transition-colors hover:bg-[var(--border)]" title="Remove">
        <MdClose size={14} style={{ color: "var(--text)" }} />
      </button>
    </div>
  );

  const titleInput = (
    <input
      value={localRule.label}
      onChange={(e) => setLocalRule({ ...localRule, label: e.target.value })}
      onBlur={(e) => commitTitle(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      onMouseDown={(e) => e.stopPropagation()}
      placeholder="Filter title"
      title="Click to rename"
      className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 text-[11px] font-semibold outline-none transition-colors hover:bg-[var(--border)] focus:bg-[var(--bg-card,var(--bg))] focus:ring-1 focus:ring-[var(--accent-ring)]"
      style={{ color: "var(--text-h)" }}
    />
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow duration-150 hover:shadow-md group"
      style={{ borderColor: isDirty ? "var(--accent)" : "var(--border)", background: "var(--bg-subtle, var(--bg))" }}
    >
      <div className="widget-drag-handle flex w-full shrink-0 cursor-grab items-center gap-2 active:cursor-grabbing px-2.5 py-1">
        <MdDragIndicator size={15} className="shrink-0 opacity-30 transition-opacity group-hover:opacity-70" style={{ color: "var(--text)" }} />
        {titleInput}
        {ApplyButton}
        {actionButtons}
      </div>

      <span className="mx-2.5 h-px shrink-0" style={{ background: "var(--border)", opacity: 0.5 }} />

      <div className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 ${vertical ? "flex-col items-stretch" : "flex-row"}`}>
        {valueArea}
      </div>

      {editOpen && (
        <FilterEditDialog
          isOpen
          initialRule={localRule}
          availableCharts={availableCharts}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => {
            setLocalRule(updated);
            onChange?.(updated);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
