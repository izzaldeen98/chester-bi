import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaHashtag,
  FaFont,
  FaCheck,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { MdSchedule } from "react-icons/md";
import { IoBarChartSharp } from "react-icons/io5";
import { FieldInfo, SourceInfo } from "@malloydata/malloy-interfaces";
import {
  listModels,
  getCompiledModel,
  runQuery,
  type ModelPackage,
  type SemanticModelSchema,
} from "../lib/Api";
import { normalizeQueryRows, getRowFieldValue } from "../lib/queryResult";
import { MalloyASTQueryBuilder } from "../lib/MalloyASTQueryBuilder";
import { DateTimeFilterSchema, DateFilterSchema, NumberFilterSchema, TextFilterSchema } from "./filters/FiltersSchema";
import CDialog from "./CDialog";
import CSpinner from "./CSpinner";
import CAlert from "./CAlert";

// ── Types ──────────────────────────────────────────────────────────────────

export type FilterKind = "datetime" | "date" | "number" | "text";
export type FilterUIType = "input" | "select" | "multiselect" | "slicer";

export interface FilterMapping {
  modelId: string;
  modelName: string;
  packageId: string;
  packageName: string;
  fieldName: string;
  sourceName: string;
}

export interface FilterRule {
  /** Display label shown in the drag handle (usually primary field name) */
  label: string;
  kind: FilterKind;
  operator: string;
  value: string;
  /** Field mapped per semantic model — enables multi-model slice-and-dice */
  mappings: FilterMapping[];
  /** Widget IDs this filter applies to; empty array means all charts */
  targetWidgetIds: string[];
  /** Layout direction of the filter widget's controls; defaults to horizontal */
  orientation?: "horizontal" | "vertical";
  /** How the value is entered; defaults to a plain input */
  uiType?: FilterUIType;
  /** Presentation for uiType "multiselect"; defaults to a list */
  multiSelectStyle?: "dropdown" | "list";
}

export interface AvailableChart {
  id: string;
  title: string;
}

interface FilterEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: FilterRule) => void;
  initialRule?: FilterRule;
  availableCharts?: AvailableChart[];
}

// ── Operator tables (see filters/FiltersSchema.ts, mirrors charts/ChartsSchemas.ts) ─

// ── Distinct value fetch (text + equals autocomplete) ────────────────────

/** Fetches distinct values for a mapped field via a group-by-only Malloy query. */
export function useDistinctFieldValues(mapping: FilterMapping | undefined, enabled: boolean) {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !mapping) { setValues([]); setError(""); return; }
    let cancelled = false;
    setLoading(true);
    setError("");

    getCompiledModel(mapping.modelId)
      .then((schema) => {
        const source = schema.sources.find((s) => s.name === mapping.sourceName);
        if (!source) throw new Error("Source not found in model");
        const builder = new MalloyASTQueryBuilder(source);
        builder.addGroupBy(mapping.fieldName);
        builder.setLimit(50);
        return runQuery(mapping.modelId, builder.buildQuery());
      })
      .then((result) => {
        if (cancelled) return;
        const rows = normalizeQueryRows(result);
        const distinct = Array.from(new Set(
          rows
            .map((r) => getRowFieldValue(r, mapping.fieldName))
            .filter((v) => v !== null && v !== undefined)
            .map((v) => String(v))
        ));
        setValues(distinct);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message ?? "Failed to load values"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [enabled, mapping?.modelId, mapping?.sourceName, mapping?.fieldName]);

  return { values, loading, error };
}

// ── Field range fetch (slicer min/max) ─────────────────────────────────────

/** Number for kind "number", epoch ms for "date"/"datetime" — a uniform numeric axis for a range slider. */
function toSliderNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const d = new Date(String(raw));
  if (!isNaN(d.getTime())) return d.getTime();
  const n = parseFloat(String(raw));
  return isNaN(n) ? null : n;
}

/** Fetches the min/max of a mapped field via a one-off aggregate Malloy query. */
export function useFieldRange(mapping: FilterMapping | undefined, enabled: boolean) {
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !mapping) { setRange(null); setError(""); return; }
    let cancelled = false;
    setLoading(true);
    setError("");

    getCompiledModel(mapping.modelId)
      .then((schema) => {
        const source = schema.sources.find((s) => s.name === mapping.sourceName);
        if (!source) throw new Error("Source not found in model");
        const query =
          `run: ${source.name} -> {\n` +
          `  aggregate:\n` +
          `    min_value is min(${mapping.fieldName})\n` +
          `    max_value is max(${mapping.fieldName})\n` +
          `}`;
        return runQuery(mapping.modelId, query);
      })
      .then((result) => {
        if (cancelled) return;
        const rows = normalizeQueryRows(result);
        const row = rows[0] ?? {};
        const min = toSliderNumber(getRowFieldValue(row, "min_value"));
        const max = toSliderNumber(getRowFieldValue(row, "max_value"));
        if (min == null || max == null) throw new Error("No range available for this field");
        setRange({ min, max });
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message ?? "Failed to load range"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [enabled, mapping?.modelId, mapping?.sourceName, mapping?.fieldName]);

  return { range, loading, error };
}

export function opsForKind(kind: FilterKind) {
  if (kind === "datetime") return DateTimeFilterSchema.operators;
  if (kind === "date")     return DateFilterSchema.operators;
  if (kind === "number")   return NumberFilterSchema.operators;
  return TextFilterSchema.operators;
}

export const NO_VALUE_OPS = ["is null", "is not null", "is empty", "is not empty", "true", "false"];
const RANGE_OPS    = ["between", "not between"];
const RELATIVE_OPS = ["after", "before"];
const STEP_OPS     = ["next", "last"];
const TIME_UNITS   = ["days", "weeks", "months", "years", "hours", "minutes", "seconds"] as const;

// ── Kind options ──────────────────────────────────────────────────────────

const KIND_OPTIONS: { value: FilterKind; label: string; icon: React.ReactNode }[] = [
  { value: "datetime", label: "DateTime",  icon: <MdSchedule size={14} /> },
  { value: "date",     label: "Date",      icon: <FaCalendarAlt size={12} /> },
  { value: "number",   label: "Number",    icon: <FaHashtag size={12} /> },
  { value: "text",     label: "Text",      icon: <FaFont size={12} /> },
];

// ── Shared input style ────────────────────────────────────────────────────

const inputCls =
  "rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]";
const inputStyle = {
  borderColor: "var(--border)",
  background: "var(--bg)",
  color: "var(--text-h)",
};

// ── Distinct value dropdown ────────────────────────────────────────────────

function DistinctValueDropdown({
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
    // Fall back to free text if the values couldn't be loaded
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Value…" className={`${inputCls} w-full`} style={inputStyle} />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className={`${inputCls} w-full cursor-pointer`}
      style={inputStyle}
    >
      <option value="">{loading ? "Loading values…" : "Select a value…"}</option>
      {values.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );
}

// ── Multi-select value picker (list, or a collapsed dropdown around the same list) ─

function MultiValuePicker({
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
  const selected = value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];

  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next.join(","));
  };

  if (error) {
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="value1, value2, …" className={`${inputCls} w-full`} style={inputStyle} />
    );
  }

  const list = (
    <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
      {loading && <div className="flex items-center justify-center py-3"><CSpinner size={14} /></div>}
      {!loading && values.length === 0 && (
        <p className="px-2 py-1 text-xs" style={{ color: "var(--text)" }}>No values found.</p>
      )}
      {!loading && values.map((v) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all hover:bg-[var(--border)]">
          <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} className="accent-[var(--accent)]" />
          <span className="truncate text-xs" style={{ color: "var(--text-h)" }}>{v}</span>
        </label>
      ))}
    </div>
  );

  if (style === "list") return list;

  return (
    <div className="relative" tabIndex={-1} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex w-full items-center justify-between gap-2 text-left`} style={inputStyle}>
        <span className="truncate">{loading ? "Loading…" : selected.length ? `${selected.length} selected` : "Select values…"}</span>
        <FaCheck size={9} style={{ opacity: open ? 1 : 0, color: "var(--accent)" }} />
      </button>
      {open && <div className="absolute z-20 mt-1 w-full shadow-lg" style={{ background: "var(--bg)" }}>{list}</div>}
    </div>
  );
}

// ── Slicer (range) value picker ────────────────────────────────────────────

function sliderFromEpoch(ms: number, kind: FilterKind): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (kind === "date") return dateStr;
  return `${dateStr} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function SlicerValuePicker({
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
        placeholder="min,max" className={`${inputCls} w-full`} style={inputStyle} />
    );
  }
  if (loading || !range) {
    return <div className="flex items-center justify-center py-3"><CSpinner size={14} /></div>;
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
    <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
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
      <div className="flex items-center justify-between text-[10px] font-medium" style={{ color: "var(--text)" }}>
        <span>{fromNum(curMin)}</span>
        <span>{fromNum(curMax)}</span>
      </div>
    </div>
  );
}

// ── Value editor ──────────────────────────────────────────────────────────

export function ValueEditor({
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
  if (NO_VALUE_OPS.includes(operator)) return null;

  // Value input type (chosen in this dialog) overrides free typing with a picker
  if (uiType === "slicer" && mapping && kind !== "text") {
    return <SlicerValuePicker mapping={mapping} kind={kind} value={value} onChange={onChange} />;
  }
  if (uiType === "multiselect" && mapping) {
    return <MultiValuePicker mapping={mapping} value={value} onChange={onChange} style={multiSelectStyle} />;
  }
  if (uiType === "select" && mapping) {
    return <DistinctValueDropdown mapping={mapping} value={value} onChange={onChange} />;
  }

  const isDateType = kind === "datetime" || kind === "date";
  const inputType  =
    kind === "datetime" ? "datetime-local"
    : kind === "date"   ? "date"
    : kind === "number" ? "number"
    : "text";

  // Relative: after / before
  if (isDateType && RELATIVE_OPS.includes(operator)) {
    const parse = (v: string) => {
      if (!v) return { type: "relative", unit: "days", amount: "1", abs: "" };
      const parts = v.split("|");
      if (parts[0] === "absolute") return { type: "absolute", unit: "days", amount: "1", abs: parts[1] ?? "" };
      return { type: "relative", unit: parts[1] ?? "days", amount: parts[2] ?? "1", abs: "" };
    };
    const { type, unit, amount, abs } = parse(value);

    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {["relative", "absolute"].map((t) => (
            <button key={t} type="button"
              onClick={() => onChange(t === "relative" ? `relative|${unit}|${amount}` : `absolute|${abs}`)}
              className="rounded-lg border px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: type === t ? "var(--accent-muted)" : "var(--bg-subtle)",
                borderColor: type === t ? "var(--accent)" : "var(--border)",
                color: type === t ? "var(--accent)" : "var(--text)",
              }}
            >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {type === "relative" && (
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={amount}
              onChange={(e) => onChange(`relative|${unit}|${e.target.value}`)}
              className={`${inputCls} w-20`} style={inputStyle} />
            <select value={unit} onChange={(e) => onChange(`relative|${e.target.value}|${amount}`)}
              className={`${inputCls} flex-1`} style={inputStyle}>
              {TIME_UNITS.map((u) => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
            </select>
          </div>
        )}
        {type === "absolute" && (
          <input type={inputType} value={abs}
            onChange={(e) => onChange(`absolute|${e.target.value}`)}
            className={`${inputCls} w-full`} style={inputStyle} />
        )}
      </div>
    );
  }

  // Step: next / last
  if (isDateType && STEP_OPS.includes(operator)) {
    const [amount = "1", unit = "days"] = value ? value.split(":") : [];
    return (
      <div className="flex items-center gap-2">
        <input type="number" min={1} value={amount}
          onChange={(e) => onChange(`${e.target.value}:${unit}`)}
          className={`${inputCls} w-20`} style={inputStyle} />
        <select value={unit} onChange={(e) => onChange(`${amount}:${e.target.value}`)}
          className={`${inputCls} flex-1`} style={inputStyle}>
          {TIME_UNITS.filter((u) => !["hours", "minutes", "seconds"].includes(u)).map((u) => (
            <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
          ))}
        </select>
      </div>
    );
  }

  // Range: between / not between
  if (RANGE_OPS.includes(operator)) {
    const [a = "", b = ""] = value ? value.split(",") : [];
    return (
      <div className="flex items-center gap-2">
        <input type={inputType} value={a}
          onChange={(e) => onChange(`${e.target.value},${b}`)}
          placeholder="From" className={`${inputCls} flex-1`} style={inputStyle} />
        <span className="text-xs" style={{ color: "var(--text)" }}>to</span>
        <input type={inputType} value={b}
          onChange={(e) => onChange(`${a},${e.target.value}`)}
          placeholder="To" className={`${inputCls} flex-1`} style={inputStyle} />
      </div>
    );
  }

  // Single value
  return (
    <input type={inputType} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value…"
      className={`${inputCls} w-full`} style={inputStyle} />
  );
}

// ── Compatibility check ────────────────────────────────────────────────────

function isCompatible(field: FieldInfo, kind: FilterKind): boolean {
  if (field.kind.toLowerCase() === "measure") return kind === "number";
  if (!("type" in field)) return false;
  const t = (field as any).type?.kind?.toLowerCase() ?? "";
  if (kind === "datetime") return t === "timestamp_type";
  if (kind === "date")     return t === "date_type";
  if (kind === "number")   return t === "number_type";
  if (kind === "text")     return t === "string_type";
  return false;
}

// ── Multi-model field picker ──────────────────────────────────────────────

interface MultiModelPickerProps {
  kind: FilterKind;
  mappings: FilterMapping[];
  onAdd: (mapping: FilterMapping) => void;
  onRemove: (modelId: string) => void;
}

function MultiModelPicker({ kind, mappings, onAdd, onRemove }: MultiModelPickerProps) {
  const [packages, setPackages]       = useState<ModelPackage[]>([]);
  const [pkgId, setPkgId]             = useState("");
  const [modelId, setModelId]         = useState("");
  const [schema, setSchema]           = useState<SemanticModelSchema | null>(null);
  const [sourceIdx, setSourceIdx]     = useState(0);
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    setLoadingPkgs(true);
    listModels()
      .then((pkgs) => { setPackages(pkgs); if (pkgs.length) setPkgId(pkgs[0].id); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingPkgs(false));
  }, []);

  const selectedPkg = packages.find((p) => p.id === pkgId);

  useEffect(() => {
    if (!pkgId) { setModelId(""); setSchema(null); return; }
    const pkg = packages.find((p) => p.id === pkgId);
    if (pkg?.models.length) setModelId(pkg.models[0].id);
  }, [pkgId, packages]);

  useEffect(() => {
    if (!modelId) { setSchema(null); return; }
    setLoadingModel(true);
    setSchema(null);
    getCompiledModel(modelId)
      .then((s) => { setSchema(s); setSourceIdx(0); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingModel(false));
  }, [modelId]);

  const activeSource: SourceInfo | undefined = schema?.sources[sourceIdx];

  const compatibleFields = useMemo(
    () => (activeSource?.schema?.fields ?? []).filter((f) => isCompatible(f as FieldInfo, kind)),
    [activeSource, kind],
  );

  const isMappedInCurrentModel = (fieldName: string) =>
    mappings.some((m) => m.modelId === modelId && m.fieldName === fieldName);

  function toggleField(fieldName: string) {
    if (isMappedInCurrentModel(fieldName)) {
      // If this model already has a mapping, remove the one for this model
      // (could be a different field — remove by modelId)
      onRemove(modelId);
      return;
    }
    const pkg  = packages.find((p) => p.id === pkgId);
    const mod  = pkg?.models.find((m) => m.id === modelId);
    if (!pkg || !mod || !activeSource) return;
    onAdd({
      modelId,
      modelName: mod.name,
      packageId: pkg.id,
      packageName: pkg.name,
      fieldName,
      sourceName: activeSource.name,
    });
  }

  if (loadingPkgs) return <div className="flex items-center justify-center py-6"><CSpinner size={18} /></div>;
  if (error) return <CAlert variant="error" message={error} />;

  return (
    <div className="flex flex-col gap-3">
      {/* Current mappings */}
      {mappings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mappings.map((m) => (
            <span key={m.modelId}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
              style={{ borderColor: "var(--accent-ring)", background: "var(--accent-muted)", color: "var(--accent)" }}
            >
              <FaCheck size={8} />
              {m.fieldName}
              <span style={{ opacity: 0.6 }}>@ {m.modelName}</span>
              <button type="button" onClick={() => onRemove(m.modelId)}
                className="ml-0.5 rounded-full transition-opacity hover:opacity-60">
                <FaTimes size={8} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Package selector */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Package</p>
        <div className="flex flex-wrap gap-1">
          {packages.map((p) => (
            <button key={p.id} type="button" onClick={() => setPkgId(p.id)}
              className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                background: pkgId === p.id ? "var(--accent-muted)" : "var(--bg-subtle)",
                borderColor: pkgId === p.id ? "var(--accent)" : "var(--border)",
                color: pkgId === p.id ? "var(--accent)" : "var(--text-h)",
              }}
            >{p.name}</button>
          ))}
        </div>
      </div>

      {/* Model selector */}
      {selectedPkg && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Model</p>
          <div className="flex flex-wrap gap-1">
            {selectedPkg.models.map((m) => {
              const hasMapped = mappings.some((mp) => mp.modelId === m.id);
              return (
                <button key={m.id} type="button" onClick={() => setModelId(m.id)}
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all"
                  style={{
                    background: modelId === m.id ? "var(--accent-muted)" : "var(--bg-subtle)",
                    borderColor: modelId === m.id ? "var(--accent)" : "var(--border)",
                    color: modelId === m.id ? "var(--accent)" : "var(--text-h)",
                  }}
                >
                  {hasMapped && <FaCheck size={8} style={{ color: "var(--accent)" }} />}
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loadingModel && <div className="flex items-center justify-center py-3"><CSpinner size={14} /></div>}

      {/* Source selector */}
      {schema && schema.sources.length > 1 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Source</p>
          <div className="flex flex-wrap gap-1">
            {schema.sources.map((s, i) => (
              <button key={s.name} type="button" onClick={() => setSourceIdx(i)}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-all"
                style={{
                  background: sourceIdx === i ? "var(--accent-muted)" : "var(--bg-subtle)",
                  borderColor: sourceIdx === i ? "var(--accent)" : "var(--border)",
                  color: sourceIdx === i ? "var(--accent)" : "var(--text-h)",
                }}
              >{s.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Field list */}
      {activeSource && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
            Fields <span className="normal-case font-normal">({compatibleFields.length} compatible)</span>
          </p>
          {compatibleFields.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text)" }}>No {kind} fields in this source.</p>
          ) : (
            <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-xl border p-1"
              style={{ borderColor: "var(--border)" }}>
              {compatibleFields.map((f) => {
                const mapped = isMappedInCurrentModel(f.name);
                return (
                  <button key={f.name} type="button" onClick={() => toggleField(f.name)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-all"
                    style={{
                      background: mapped ? "var(--accent-muted)" : "transparent",
                      color: mapped ? "var(--accent)" : "var(--text-h)",
                    }}
                  >
                    {mapped
                      ? <FaCheck size={10} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      : <FaPlus size={9} style={{ color: "var(--text)", flexShrink: 0 }} />
                    }
                    <span className="truncate">{f.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Target chart selector ─────────────────────────────────────────────────

interface TargetChartSelectorProps {
  availableCharts: AvailableChart[];
  targetWidgetIds: string[];
  onToggle: (id: string) => void;
}

function TargetChartSelector({ availableCharts, targetWidgetIds, onToggle }: TargetChartSelectorProps) {
  if (availableCharts.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: "var(--text)" }}>
        No chart widgets on the dashboard yet.
      </p>
    );
  }

  const allSelected = targetWidgetIds.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all hover:bg-[var(--border)]">
        <input type="checkbox" checked={allSelected}
          onChange={() => { if (!allSelected) { /* clear = select all */ onToggle("__all__"); } }}
          className="accent-[var(--accent)]"
        />
        <span className="text-xs font-medium" style={{ color: "var(--text-h)" }}>All charts</span>
        <span className="ml-auto text-[10px]" style={{ color: "var(--text)" }}>default</span>
      </label>
      {availableCharts.map((c) => {
        const checked = targetWidgetIds.includes(c.id);
        return (
          <label key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all hover:bg-[var(--border)]">
            <input type="checkbox" checked={checked}
              onChange={() => onToggle(c.id)}
              className="accent-[var(--accent)]"
            />
            <IoBarChartSharp size={11} style={{ color: "var(--text)", flexShrink: 0 }} />
            <span className="truncate text-xs" style={{ color: "var(--text-h)" }}>{c.title}</span>
          </label>
        );
      })}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────

export default function FilterEditDialog({
  isOpen,
  onClose,
  onSave,
  initialRule,
  availableCharts = [],
}: FilterEditDialogProps) {
  const [title,           setTitle]           = useState(initialRule?.label ?? "");
  const [kind,            setKind]            = useState<FilterKind>(initialRule?.kind ?? "text");
  const [operator,        setOperator]        = useState(initialRule?.operator ?? "");
  const [value,           setValue]           = useState(initialRule?.value ?? "");
  const [uiType,          setUiType]          = useState<FilterUIType>(initialRule?.uiType ?? "input");
  const [multiSelectStyle, setMultiSelectStyle] = useState<"dropdown" | "list">(initialRule?.multiSelectStyle ?? "list");
  const [mappings,        setMappings]        = useState<FilterMapping[]>(initialRule?.mappings ?? []);
  const [targetWidgetIds, setTargetWidgetIds] = useState<string[]>(initialRule?.targetWidgetIds ?? []);

  // Reset operator + value when kind changes
  useEffect(() => {
    setOperator(opsForKind(kind)[0].value);
    setValue("");
  }, [kind]);

  function addMapping(m: FilterMapping) {
    setMappings((prev) => [...prev.filter((x) => x.modelId !== m.modelId), m]);
  }

  function removeMapping(modelId: string) {
    setMappings((prev) => prev.filter((m) => m.modelId !== modelId));
  }

  function toggleTarget(id: string) {
    if (id === "__all__") { setTargetWidgetIds([]); return; }
    setTargetWidgetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const ops     = opsForKind(kind);
  const canSave = !!operator && mappings.length > 0;
  const label   = title.trim() || mappings[0]?.fieldName || "";

  function handleSave() {
    if (!canSave) return;
    onSave({ label, kind, operator, value, mappings, targetWidgetIds, orientation: initialRule?.orientation, uiType, multiSelectStyle });
    onClose();
  }

  return (
    <CDialog
      isOpen={isOpen}
      title="Configure Filter"
      subtitle="Define a filter rule, map it to model fields, and choose which charts it affects"
      onClose={onClose}
      onSave={handleSave}
      saveLabel="Apply Filter"
      saveDisabled={!canSave}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Left panel: type + operator + value ───────────────────────── */}
        <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r p-5"
          style={{ borderColor: "var(--border)", background: "var(--bg)" }}>

          {/* Title */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
              Title
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mappings[0]?.fieldName || "Filter"}
              className={`${inputCls} w-full`}
              style={inputStyle}
            />
          </div>

          {/* Filter kind */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
              Filter type
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {KIND_OPTIONS.map((k) => (
                <button key={k.value} type="button" onClick={() => setKind(k.value)}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all"
                  style={{
                    background: kind === k.value ? "var(--accent-muted)" : "var(--bg-subtle)",
                    borderColor: kind === k.value ? "var(--accent)" : "var(--border)",
                    color: kind === k.value ? "var(--accent)" : "var(--text-h)",
                  }}
                >
                  <span style={{ color: kind === k.value ? "var(--accent)" : "var(--text)" }}>{k.icon}</span>
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Operator */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
              Operator
            </p>
            <select
              value={operator}
              onChange={(e) => { setOperator(e.target.value); setValue(""); }}
              className={`${inputCls} w-full cursor-pointer`}
              style={inputStyle}
            >
              {ops.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>

          {/* Value */}
          {!NO_VALUE_OPS.includes(operator) && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                  Value
                </p>
                <div className="flex gap-1">
                  {(["input", "select", "multiselect", "slicer"] as FilterUIType[])
                    .filter((t) => t !== "multiselect" || kind === "text" || kind === "number")
                    .filter((t) => t !== "slicer" || kind !== "text")
                    .map((t) => (
                      <button key={t} type="button" onClick={() => setUiType(t)}
                        title={t === "multiselect" ? "Multi-select" : t}
                        className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize transition-all"
                        style={{
                          background: uiType === t ? "var(--accent-muted)" : "transparent",
                          borderColor: uiType === t ? "var(--accent)" : "var(--border)",
                          color: uiType === t ? "var(--accent)" : "var(--text)",
                        }}
                      >{t === "multiselect" ? "Multi" : t}</button>
                    ))}
                </div>
              </div>

              {uiType === "multiselect" && (
                <div className="mb-2 flex gap-1.5">
                  {(["list", "dropdown"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setMultiSelectStyle(s)}
                      className="rounded-md border px-2 py-1 text-[10px] font-medium capitalize transition-all"
                      style={{
                        background: multiSelectStyle === s ? "var(--accent-muted)" : "var(--bg-subtle)",
                        borderColor: multiSelectStyle === s ? "var(--accent)" : "var(--border)",
                        color: multiSelectStyle === s ? "var(--accent)" : "var(--text-h)",
                      }}
                    >{s}</button>
                  ))}
                </div>
              )}

              <ValueEditor
                kind={kind} operator={operator} value={value} onChange={setValue}
                mapping={mappings[0]} uiType={uiType} multiSelectStyle={multiSelectStyle}
              />
            </div>
          )}
        </div>

        {/* ── Right panel: model mappings + target charts ────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-5"
          style={{ background: "var(--bg-subtle)" }}>

          {/* Model mappings */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                Model field mappings
              </p>
              {mappings.length > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
                  {mappings.length}
                </span>
              )}
            </div>
            {mappings.length === 0 && (
              <p className="mb-2 text-[11px]" style={{ color: "var(--text)" }}>
                Select a field below to add a mapping. You can add multiple mappings from different models.
              </p>
            )}
            <MultiModelPicker
              kind={kind}
              mappings={mappings}
              onAdd={addMapping}
              onRemove={removeMapping}
            />
          </div>

          {/* Target charts */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                Target charts
              </p>
              {targetWidgetIds.length > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
                  {targetWidgetIds.length}
                </span>
              )}
            </div>
            <p className="mb-2 text-[11px]" style={{ color: "var(--text)" }}>
              Leave as "All charts" to filter every chart, or select specific ones.
            </p>
            <TargetChartSelector
              availableCharts={availableCharts}
              targetWidgetIds={targetWidgetIds}
              onToggle={toggleTarget}
            />
          </div>

        </div>
      </div>
    </CDialog>
  );
}
