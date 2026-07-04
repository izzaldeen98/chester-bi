import { useState, useEffect } from "react";
import { MdDragIndicator, MdClose, MdEdit, MdCheck } from "react-icons/md";
import { FaCalendarAlt, FaHashtag, FaFont } from "react-icons/fa";
import { MdSchedule } from "react-icons/md";
import {
  type FilterRule,
  type FilterKind,
  type AvailableChart,
  opsForKind,
  NO_VALUE_OPS,
} from "./FilterEditDialog";
import FilterEditDialog from "./FilterEditDialog";

// ── Kind icon ─────────────────────────────────────────────────────────────

function KindIcon({ kind }: { kind: FilterKind }) {
  const s = { color: "var(--accent)", flexShrink: 0 } as const;
  if (kind === "datetime") return <MdSchedule size={12} style={s} />;
  if (kind === "date")     return <FaCalendarAlt size={11} style={s} />;
  if (kind === "number")   return <FaHashtag size={11} style={s} />;
  return <FaFont size={11} style={s} />;
}

// ── Compact value editor ──────────────────────────────────────────────────

const iCls =
  "rounded-md border text-[11px] font-medium px-2 py-1 outline-none transition-all duration-150 ease-in-out focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)] shadow-sm";
const iSty = {
  borderColor: "var(--border-muted, var(--border))",
  background: "var(--bg-card, var(--bg))",
  color: "var(--text-h)",
  minWidth: 0,
} as const;

const DATE_UNITS = ["days", "weeks", "months", "years"] as const;

function CompactValueEditor({
  kind,
  operator,
  value,
  onChange,
}: {
  kind: FilterKind;
  operator: string;
  value: string;
  onChange: (v: string) => void;
}) {
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
      <div className="flex shrink-0 items-center gap-1">
        <input type="number" min={1} value={amt}
          onChange={(e) => onChange(`${e.target.value}:${unit}`)}
          className={iCls} style={{ ...iSty, width: 48 }} />
        <select value={unit} onChange={(e) => onChange(`${amt}:${e.target.value}`)}
          className={`${iCls} cursor-pointer pr-4`} style={iSty}>
          {DATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    );
  }

  // after / before  →  parse stored value, show date or relative [n][unit]
  if (isDate && ["after", "before"].includes(operator)) {
    const isAbsolute = value.startsWith("absolute|");
    const isRelative = value.startsWith("relative|") || (!isAbsolute && !value.startsWith("absolute"));

    if (isAbsolute) {
      const abs = value.slice(9);
      return (
        <input type={inputType} value={abs}
          onChange={(e) => onChange(`absolute|${e.target.value}`)}
          className={iCls} style={{ ...iSty, width: 140 }} />
      );
    }

    // relative  →  [n] [unit ▼]
    const [, unit = "days", amt = "1"] = isRelative ? value.split("|") : ["relative", "days", "1"];
    return (
      <div className="flex shrink-0 items-center gap-1">
        <input type="number" min={1} value={amt}
          onChange={(e) => onChange(`relative|${unit}|${e.target.value}`)}
          className={iCls} style={{ ...iSty, width: 48 }} />
        <select value={unit} onChange={(e) => onChange(`relative|${e.target.value}|${amt}`)}
          className={`${iCls} cursor-pointer pr-4`} style={iSty}>
          {DATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    );
  }

  // between / not between  →  [from] – [to]
  if (["between", "not between"].includes(operator)) {
    const [a = "", b = ""] = value ? value.split(",") : [];
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <input type={inputType} value={a}
          onChange={(e) => onChange(`${e.target.value},${b}`)}
          placeholder="From" className={iCls} style={{ ...iSty, width: 95 }} />
        <span className="text-[10px] shrink-0 font-medium opacity-60" style={{ color: "var(--text)" }}>to</span>
        <input type={inputType} value={b}
          onChange={(e) => onChange(`${a},${e.target.value}`)}
          placeholder="To" className={iCls} style={{ ...iSty, width: 95 }} />
      </div>
    );
  }

  // single value
  return (
    <input type={inputType} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value…"
      className={iCls} style={{ ...iSty, minWidth: 90, maxWidth: 160 }} />
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

  // ── Local draft state ────────────────────────────────────────────────────
  // Changes to operator/value update localRule only.
  // onChange (which triggers chart re-queries) is called only when Apply is clicked.
  const [localRule, setLocalRule] = useState(rule);

  // Sync draft whenever the parent commits a new rule (initial load, FilterEditDialog save)
  useEffect(() => { setLocalRule(rule); }, [rule]);

  const isDirty = JSON.stringify(localRule) !== JSON.stringify(rule);
  const handleApply = () => onChange?.(localRule);

  // ── Derived display values (from localRule so UI stays responsive) ────────
  const ops        = opsForKind(localRule.kind);
  const noValue    = NO_VALUE_OPS.includes(localRule.operator);
  const opLabel    = ops.find((o) => o.value === localRule.operator)?.label ?? localRule.operator;
  const fieldLabel = localRule.label || localRule.mappings[0]?.fieldName || "Filter";

  const targetBadge =
    localRule.targetWidgetIds.length > 0
      ? `${localRule.targetWidgetIds.length} Chart${localRule.targetWidgetIds.length !== 1 ? "s" : ""}`
      : null;

  // "workspace mode" = the widget is inside the editor (delete button is provided)
  const isWorkspace = onDelete !== undefined;

  // ── Apply button ─────────────────────────────────────────────────────────
  const ApplyButton = (
    <button
      type="button"
      onClick={handleApply}
      disabled={!isDirty}
      title={isDirty ? "Apply filter" : "No changes"}
      className="shrink-0 flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-all"
      style={isDirty ? {
        background: "var(--accent)",
        color: "#fff",
        border: "1px solid var(--accent)",
        cursor: "pointer",
      } : {
        background: "transparent",
        color: "var(--text)",
        border: "1px solid var(--border)",
        opacity: 0.45,
        cursor: "default",
      }}
    >
      <MdCheck size={11} />
      Apply
    </button>
  );

  /* ─────────────────────────────────────────────────────────────────────────
     VIEW MODE  –  compact interactive pill (no drag chrome, no action buttons)
  ───────────────────────────────────────────────────────────────────────── */
  if (!isWorkspace) {
    return (
      <div
        className="flex h-full w-full items-center overflow-hidden border shadow-sm"
        style={{ borderColor: isDirty ? "var(--accent)" : "var(--border)", background: "var(--bg)", borderRadius: 10, transition: "border-color 0.15s" }}
      >
        {/* Field / kind label */}
        <div
          className="flex h-full shrink-0 items-center gap-1.5 px-3 select-none"
          style={{ borderRight: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`, background: "var(--bg-subtle)", transition: "border-color 0.15s" }}
        >
          <div className="flex items-center justify-center rounded"
            style={{ padding: 3, background: "var(--accent-muted)" }}>
            <KindIcon kind={localRule.kind} />
          </div>
          <span
            className="shrink-0 truncate text-[11px] font-semibold"
            style={{ color: "var(--text-h)", maxWidth: 90 }}
            title={fieldLabel}
          >
            {fieldLabel}
          </span>
        </div>

        {/* Interactive controls */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 py-1">
          {readOnly ? (
            <span
              className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text-h)" }}
            >
              {opLabel}
            </span>
          ) : (
            <select
              value={localRule.operator}
              onChange={(e) => setLocalRule({ ...localRule, operator: e.target.value, value: "" })}
              className="shrink-0 rounded border px-2 py-0.5 text-[11px] font-medium outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] cursor-pointer"
              style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text-h)" }}
            >
              {ops.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          )}

          {!noValue && !readOnly && (
            <CompactValueEditor
              kind={localRule.kind}
              operator={localRule.operator}
              value={localRule.value}
              onChange={(v) => setLocalRule({ ...localRule, value: v })}
            />
          )}
          {!noValue && readOnly && localRule.value && (
            <span
              className="shrink-0 max-w-[160px] truncate rounded border px-2 py-0.5 text-[11px]"
              style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text-h)" }}
              title={localRule.value}
            >
              {localRule.value}
            </span>
          )}
          {!noValue && !readOnly && !localRule.value && (
            <span className="text-[10px] italic" style={{ color: "var(--text)" }}>any</span>
          )}

          {targetBadge && (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold"
              style={{ borderColor: "var(--accent)", background: "var(--accent-muted)", color: "var(--accent)", opacity: 0.9 }}
            >
              {targetBadge}
            </span>
          )}

          <div className="min-w-0 flex-1" />

          {!readOnly && ApplyButton}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     WORKSPACE MODE  –  drag handle + full controls + action buttons
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div
      className="flex h-full w-full overflow-hidden border shadow-sm group"
      style={{ borderColor: isDirty ? "var(--accent)" : "var(--border)", background: "var(--bg-subtle)", borderRadius: 10, transition: "border-color 0.15s" }}
    >
      {/* Drag handle strip */}
      <div
        className="widget-drag-handle flex h-full shrink-0 cursor-grab items-center gap-2 pl-3 pr-2 active:cursor-grabbing select-none"
        style={{ borderRight: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`, transition: "border-color 0.15s" }}
      >
        <MdDragIndicator size={14} className="opacity-40 group-hover:opacity-70" style={{ color: "var(--text)", flexShrink: 0 }} />
        <div className="flex items-center justify-center rounded"
          style={{ padding: 3, background: "var(--accent-muted)" }}>
          <KindIcon kind={localRule.kind} />
        </div>
        <span
          className="shrink-0 truncate text-[11px] font-semibold"
          style={{ color: "var(--text-h)", maxWidth: 80 }}
          title={fieldLabel}
        >
          {fieldLabel}
        </span>
      </div>

      {/* Interactive controls */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-3">
        <select
          value={localRule.operator}
          onChange={(e) => setLocalRule({ ...localRule, operator: e.target.value, value: "" })}
          className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-h)" }}
        >
          {ops.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
        </select>

        {!noValue && (
          <CompactValueEditor
            kind={localRule.kind}
            operator={localRule.operator}
            value={localRule.value}
            onChange={(v) => setLocalRule({ ...localRule, value: v })}
          />
        )}

        {targetBadge && (
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold"
            style={{ borderColor: "var(--accent)", background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            {targetBadge}
          </span>
        )}

        <div className="min-w-0 flex-1" />

        {ApplyButton}

        {/* Divider */}
        <span className="h-3 w-px shrink-0" style={{ background: "var(--border)" }} />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="shrink-0 rounded p-1 transition-colors hover:bg-[var(--border)]"
            title="Edit filter"
          >
            <MdEdit size={13} style={{ color: "var(--text)" }} />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.()}
            className="shrink-0 rounded p-1 transition-colors hover:bg-[var(--border)]"
            title="Remove"
          >
            <MdClose size={14} style={{ color: "var(--text)" }} />
          </button>
        </div>
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