import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FaPlus, FaTrash, FaChevronDown, FaChevronRight, FaLock } from "react-icons/fa";
import CButton from "./CButton";
import CTextInput from "./CTextInput";
import CAlert from "./CAlert";
import CSpinner from "./CSpinner";
import {
  getConnections,
  getConnectionSchemas,
  getSchemaTables,
  getFiles,
  getFileSchema,
  type ConnectionPublicResponse,
  type FilePublicResponse,
} from "../lib/Api";

// ── Types ────────────────────────────────────────────────────────────────

export type JoinRelationship = "one_to_one" | "one_to_many" | "many_to_one" | "many_to_many";
export type AggFn = "count" | "sum" | "avg" | "min" | "max";
export type SourceType = "connection" | "file";
export type DimensionType = "string" | "number" | "boolean" | "time";

/** Cube's display-formatting hint — purely presentational, doesn't affect
 * the value itself, just how BI tools render it. "" means unset/default. */
export type DimensionFormat = "" | "id" | "imageUrl" | "link" | "currency" | "percent";
export type MeasureFormat = "" | "currency" | "percent";

export type DimensionMode = "column" | "expression";
/** A dimension is either a raw column exposed as-is (`mode: "column"`, name
 * optional — defaults to the column name) or a computed SQL expression
 * (Cube's `sql:` is raw SQL, not a Malloy expression). */
export interface WizardDimension { id: string; name: string; mode: DimensionMode; field: string; expression: string; type: DimensionType; format: DimensionFormat }
export type MeasureKind = "function" | "expression";
export interface WizardMeasure { id: string; name: string; kind: MeasureKind; fn: AggFn; field: string; expression: string; format: MeasureFormat }
export interface WizardJoin { id: string; relationship: JoinRelationship; targetSource: string; on: string }

export interface WizardSource {
  id: string;
  name: string;
  sourceType: SourceType;
  // sourceType "connection"
  connectionId: string;
  connectionName: string;
  schema: string;
  // sourceType "file"
  fileId: string;
  // resolved table/path reference — a "schema.table" for connections, or the
  // in-container file path for a DuckDB-over-file source
  tableRef: string;
  /** Optional — mainly matters for join correctness */
  primaryKey: string;
  /** True for a source loaded from an already-saved definition file — its
   * primary key is locked once saved (see SourceCard); remove and re-add
   * the source to pick a different one. False for one freshly added in the
   * wizard this session, whose primary key is still free to set. */
  existing: boolean;
  dimensions: WizardDimension[];
  measures: WizardMeasure[];
  joins: WizardJoin[];
}

/** Raw table columns with any renamed ones swapped for their new name — once a
 * column-mode dimension renames a column, only the new name is a valid field
 * reference downstream (measures, primary key, further expressions), the old
 * one no longer exists. */
function effectiveColumns(columns: string[], dimensions: WizardDimension[]): string[] {
  return columns.map((c) => {
    const renamed = dimensions.find((d) => d.mode === "column" && d.name.trim() && d.field.trim() === c);
    return renamed ? renamed.name.trim() : c;
  });
}

const AGG_FNS: AggFn[] = ["count", "sum", "avg", "min", "max"];
const DIMENSION_TYPES: DimensionType[] = ["string", "number", "boolean", "time"];
const DIMENSION_FORMATS: { value: DimensionFormat; label: string }[] = [
  { value: "", label: "No format" },
  { value: "id", label: "ID" },
  { value: "imageUrl", label: "Image URL" },
  { value: "link", label: "Link" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
];
const MEASURE_FORMATS: { value: MeasureFormat; label: string }[] = [
  { value: "", label: "No format" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
];
const JOIN_RELATIONSHIPS: { value: JoinRelationship; label: string; hint: string }[] = [
  { value: "many_to_one", label: "Many : One", hint: "many rows here match at most one row there (foreign-key style)" },
  { value: "one_to_many", label: "One : Many", hint: "one row here can match many rows there" },
  { value: "one_to_one", label: "One : One", hint: "at most one matching row on each side" },
  { value: "many_to_many", label: "Many : Many", hint: "every combination" },
];

// Files live in the same shared volume the Cube container mounts at
// /cube/definitions_root (see docker-compose.yml + backend/cube_conf/cube.js) —
// File.path already starts with "cube_data/…", so this is the exact absolute
// path a DuckDB-backed cube's `sql:` needs to read the file directly.
const CUBE_VOLUME_ROOT = "/cube/definitions_root";

/** The canonical in-container path a DuckDB-over-file cube reads this file
 * from. The cube container's volume maps .local/cube_data (host) ->
 * CUBE_VOLUME_ROOT, so File.path's "cube_data/" prefix is stripped before
 * joining or it would appear twice. Single source of truth: both the
 * file-picker (writing tableRef) and the reverse lookup that re-selects a
 * file when parsing existing YAML must agree, or the dropdown reads blank. */
function fileTableRef(file: FilePublicResponse): string {
  const inContainerDir = file.path.replace(/^cube_data\//, "");
  return `${CUBE_VOLUME_ROOT}/${inContainerDir}/${file.file_name}`;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

/** JSON string literals are valid YAML double-quoted scalars — reusing
 * JSON.stringify's escaping sidesteps hand-rolling YAML quoting rules and
 * round-trips exactly via JSON.parse in the parser below. */
function yamlStr(value: string): string {
  return JSON.stringify(value);
}

// ── Introspection response normalizers ──────────────────────────────────
// Schemas are `{name, isHidden, isDefault}`, tables are `{resource, columns}`
// — NOT `{name}` — so they need separate extraction, matching what
// backend/utils/db_drivers.py returns (shaped to match, on purpose).

function normalizeSchemas(items: unknown[]): string[] {
  return items
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null && !item.isHidden)
    .map((item) => (typeof item.name === "string" ? item.name : ""))
    .filter(Boolean);
}

export interface TableInfo {
  resource: string;
  columns: string[];
}

function normalizeTables(items: unknown[]): TableInfo[] {
  return items
    .map((item) => {
      if (typeof item === "string") return { resource: item, columns: [] };
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const resource = typeof obj.resource === "string" ? obj.resource : typeof obj.name === "string" ? obj.name : "";
      if (!resource) return null;
      const rawColumns = Array.isArray(obj.columns) ? obj.columns : [];
      const columns = rawColumns
        .map((c) => (c && typeof c === "object" && typeof (c as Record<string, unknown>).name === "string"
          ? String((c as Record<string, unknown>).name)
          : ""))
        .filter(Boolean);
      return { resource, columns };
    })
    .filter((item): item is TableInfo => item !== null);
}

export function newWizardSource(): WizardSource {
  return {
    id: uid(),
    name: "",
    sourceType: "connection",
    connectionId: "",
    connectionName: "",
    schema: "",
    fileId: "",
    tableRef: "",
    primaryKey: "",
    existing: false,
    dimensions: [],
    measures: [],
    joins: [],
  };
}

/** Generates a Cube `cubes:` YAML block — the only place Cube schema syntax
 * gets built. One WizardSource -> one cube list entry; every configured
 * source lands in a single YAML document (matching how the old Malloy
 * wizard put every source into one .malloy file). */
export function generateCubeYaml(sources: WizardSource[]): string {
  // A connection-type source with no connection actually selected would emit
  // `data_source: "default"` — Cube's own implicit data source name when
  // none is set — which never matches a real account connection and blows up
  // driverFactory at query/compile time. Excluding it here (rather than
  // falling back to a fake "default" value) means an incomplete source is
  // just not queryable yet, instead of silently generating a broken cube.
  const valid = sources.filter((s) =>
    s.name.trim() && s.tableRef.trim() && (s.sourceType === "file" || s.connectionName.trim()),
  );
  if (valid.length === 0) return "";

  const lines: string[] = ["cubes:"];
  for (const s of valid) {
    lines.push(`  - name: ${yamlStr(s.name.trim())}`);
    if (s.sourceType === "file") {
      const isParquet = s.tableRef.trim().toLowerCase().endsWith(".parquet");
      const readFn = isParquet ? "read_parquet" : "read_csv";
      lines.push(`    sql: ${yamlStr(`SELECT * FROM ${readFn}('${s.tableRef.trim()}')`)}`);
      lines.push(`    data_source: "duckdb"`);
    } else {
      lines.push(`    sql_table: ${yamlStr(s.tableRef.trim())}`);
      lines.push(`    data_source: ${yamlStr(s.connectionName.trim())}`);
    }

    // If the primary-key column got renamed by a column-mode dimension, point
    // at the new name — the old column name won't exist as a dimension.
    let primaryKey = s.primaryKey.trim();
    if (primaryKey) {
      const renamedTo = s.dimensions.find((d) => d.mode === "column" && d.name.trim() && d.field.trim() === primaryKey);
      if (renamedTo) primaryKey = renamedTo.name.trim();
    }

    const dimensionEntries: { name: string; sql: string; type: DimensionType; format: DimensionFormat; isPrimaryKey: boolean }[] = [];
    for (const d of s.dimensions) {
      const sql = d.mode === "column" ? d.field.trim() : d.expression.trim();
      if (!sql) continue;
      // Title is optional for a plain column dimension — default to the
      // column name itself; an expression has no natural default so it needs one.
      const name = d.name.trim() || (d.mode === "column" ? sql : "");
      if (!name) continue;
      // A bare column reference must be qualified with {CUBE} — left
      // unqualified, Cube emits it as-is in the compiled SQL, and if this
      // cube is joined to another one exposing the same raw column name
      // (common with `SELECT *`-over-file sources), the query fails with a
      // "Binder Error: Ambiguous reference to column" from the SQL engine.
      const emittedSql = d.mode === "column" ? `{CUBE}.${sql}` : sql;
      dimensionEntries.push({ name, sql: emittedSql, type: d.type, format: d.format, isPrimaryKey: name === primaryKey });
    }
    if (dimensionEntries.length) {
      lines.push("    dimensions:");
      for (const d of dimensionEntries) {
        lines.push(`      - name: ${yamlStr(d.name)}`);
        lines.push(`        sql: ${yamlStr(d.sql)}`);
        lines.push(`        type: ${yamlStr(d.type)}`);
        if (d.format) lines.push(`        format: ${yamlStr(d.format)}`);
        if (d.isPrimaryKey) lines.push(`        primary_key: true`);
      }
    }

    const measureEntries = s.measures.filter((m) => m.name.trim() && (m.kind === "expression" ? m.expression.trim() : m.field.trim()));
    if (measureEntries.length) {
      lines.push("    measures:");
      for (const m of measureEntries) {
        lines.push(`      - name: ${yamlStr(m.name.trim())}`);
        if (m.kind === "expression") {
          // Cube's `type: number` measures combine other measures arithmetically
          // via {measureName} references — the Cube-native equivalent of
          // Malloy's free-form "sum(a) - sum(b)" expression measures.
          lines.push(`        sql: ${yamlStr(m.expression.trim())}`);
          lines.push(`        type: "number"`);
        } else {
          // Same ambiguous-column risk as dimensions — qualify with {CUBE}.
          lines.push(`        sql: ${yamlStr(`{CUBE}.${m.field.trim()}`)}`);
          lines.push(`        type: ${yamlStr(m.fn)}`);
        }
        if (m.format) lines.push(`        format: ${yamlStr(m.format)}`);
      }
    }

    const joinEntries = s.joins.filter((j) => j.targetSource.trim() && j.on.trim());
    if (joinEntries.length) {
      lines.push("    joins:");
      for (const j of joinEntries) {
        lines.push(`      - name: ${yamlStr(j.targetSource.trim())}`);
        lines.push(`        sql: ${yamlStr(j.on.trim())}`);
        lines.push(`        relationship: ${yamlStr(j.relationship)}`);
      }
    }
  }

  return lines.join("\n");
}

const JOIN_RELATIONSHIP_VALUES = new Set<JoinRelationship>(["one_to_one", "one_to_many", "many_to_one", "many_to_many"]);
const AGG_FN_VALUES = new Set<AggFn>(["count", "sum", "avg", "min", "max"]);
const DIMENSION_TYPE_VALUES = new Set<DimensionType>(["string", "number", "boolean", "time"]);
const DIMENSION_FORMAT_VALUES = new Set<DimensionFormat>(["id", "imageUrl", "link", "currency", "percent"]);
const MEASURE_FORMAT_VALUES = new Set<MeasureFormat>(["currency", "percent"]);

function unquote(raw: string): string {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Recognizes a bare column reference — either unqualified ("status") or
 * {CUBE}-qualified ("{CUBE}.status", the form the generator now always
 * writes) — and returns just the column name; null for anything else
 * (function calls, operators, literals, cross-cube references). */
function parseColumnRef(value: string): string | null {
  const cubeQualified = value.match(/^\{CUBE\}\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (cubeQualified) return cubeQualified[1];
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return value;
  return null;
}

/**
 * Parses the subset of Cube YAML this wizard itself generates back into
 * structured sources. This is a bespoke line-based parser for the wizard's
 * own fixed-shape output (matching generateCubeYaml's exact indentation),
 * not a general YAML parser — hand-authored or otherwise-shaped YAML simply
 * won't round-trip into the builder (it's still valid Cube schema, just not
 * editable here).
 */
export function parseCubeYamlToSources(text: string): WizardSource[] {
  if (!text || !text.trim()) return [newWizardSource()];

  const lines = text.split("\n");
  const sources: WizardSource[] = [];
  let current: WizardSource | null = null;
  let section: "" | "dimensions" | "measures" | "joins" = "";
  let pendingPrimaryKeyName: string | null = null;

  const kv = (line: string): { key: string; value: string } | null => {
    // YAML allows whitespace before the colon ("primary_key : true") and
    // real definition files in the wild use it — tolerate it here or the
    // whole line is silently skipped and its setting lost on round-trip.
    const m = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (!m) return null;
    return { key: m[1], value: m[2].trim() };
  };

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim() === "cubes:") continue;

    const cubeStart = rawLine.match(/^\s{2}-\s*name\s*:\s*(.+)$/);
    if (cubeStart) {
      if (current) {
        if (pendingPrimaryKeyName) current.primaryKey = pendingPrimaryKeyName;
        sources.push(current);
      }
      current = { ...newWizardSource(), name: unquote(cubeStart[1].trim()), existing: true };
      section = "";
      pendingPrimaryKeyName = null;
      continue;
    }
    if (!current) continue;

    // Cube-level fields (4-space indent)
    if (/^\s{4}\S/.test(rawLine) && !/^\s{4}-/.test(rawLine)) {
      const pair = kv(rawLine.trim());
      if (!pair) continue;
      if (pair.key === "sql_table") {
        current.sourceType = "connection";
        current.tableRef = unquote(pair.value);
      } else if (pair.key === "sql" && section === "") {
        current.sourceType = "file";
        const match = unquote(pair.value).match(/read_(?:csv|parquet)\('([^']*)'\)/);
        current.tableRef = match ? match[1] : "";
      } else if (pair.key === "data_source") {
        const ds = unquote(pair.value);
        if (ds !== "duckdb") current.connectionName = ds;
      } else if (pair.key === "dimensions") {
        section = "dimensions";
      } else if (pair.key === "measures") {
        section = "measures";
      } else if (pair.key === "joins") {
        section = "joins";
      }
      continue;
    }

    // List item start within a section (6-space indent, "- name: ...")
    const itemStart = rawLine.match(/^\s{6}-\s*name\s*:\s*(.+)$/);
    if (itemStart && section) {
      const name = unquote(itemStart[1].trim());
      if (section === "dimensions") {
        current.dimensions.push({ id: uid(), name, mode: "expression", field: "", expression: "", type: "string", format: "" });
      } else if (section === "measures") {
        current.measures.push({ id: uid(), name, kind: "function", fn: "count", field: "", expression: "", format: "" });
      } else if (section === "joins") {
        current.joins.push({ id: uid(), relationship: "many_to_one", targetSource: name, on: "" });
      }
      continue;
    }

    // Fields of the current list item (8-space indent)
    if (/^\s{8}\S/.test(rawLine)) {
      const pair = kv(rawLine.trim());
      if (!pair) continue;
      const value = unquote(pair.value);

      if (section === "dimensions") {
        const dim = current.dimensions[current.dimensions.length - 1];
        if (!dim) continue;
        if (pair.key === "sql") {
          const columnRef = parseColumnRef(value);
          if (columnRef) { dim.mode = "column"; dim.field = columnRef; }
          else { dim.mode = "expression"; dim.expression = value; }
        }
        else if (pair.key === "type" && DIMENSION_TYPE_VALUES.has(value as DimensionType)) dim.type = value as DimensionType;
        else if (pair.key === "format" && DIMENSION_FORMAT_VALUES.has(value as DimensionFormat)) dim.format = value as DimensionFormat;
        // Raw (unquoted) YAML boolean — `unquote`'s JSON.parse would turn
        // it into the actual boolean `true`, not the string "true", so
        // compare against the un-parsed token instead.
        else if (pair.key === "primary_key" && pair.value === "true") pendingPrimaryKeyName = dim.name;
      } else if (section === "measures") {
        const m = current.measures[current.measures.length - 1];
        if (!m) continue;
        if (pair.key === "type" && value === "number") {
          m.kind = "expression";
        } else if (pair.key === "type" && AGG_FN_VALUES.has(value as AggFn)) {
          m.kind = "function";
          m.fn = value as AggFn;
        } else if (pair.key === "sql") {
          if (m.kind === "expression") m.expression = value;
          else m.field = parseColumnRef(value) ?? value;
        } else if (pair.key === "format" && MEASURE_FORMAT_VALUES.has(value as MeasureFormat)) {
          m.format = value as MeasureFormat;
        }
      } else if (section === "joins") {
        const j = current.joins[current.joins.length - 1];
        if (!j) continue;
        if (pair.key === "sql") j.on = value;
        else if (pair.key === "relationship" && JOIN_RELATIONSHIP_VALUES.has(value as JoinRelationship)) j.relationship = value as JoinRelationship;
      }
    }
  }

  if (current) {
    if (pendingPrimaryKeyName) current.primaryKey = pendingPrimaryKeyName;
    sources.push(current);
  }

  return sources.length > 0 ? sources : [newWizardSource()];
}

// ── Shared row styling ───────────────────────────────────────────────────

const rowInputCls =
  "min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-all " +
  "focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]";
const rowInputSty = { borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-h)" };

const selectCls =
  "w-full rounded-xl border bg-[var(--bg)] px-3.5 py-2.5 text-sm outline-none transition-all " +
  "focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";

/** Column picker for a dimension/measure's underlying field — a select when the
 * source's columns are known (from table/file introspection), else a plain
 * text fallback so the row stays usable even when introspection failed. */
function FieldPicker({
  value, onChange, columns, style, disabled, title,
}: {
  value: string;
  onChange: (v: string) => void;
  columns: string[];
  style?: CSSProperties;
  disabled?: boolean;
  title?: string;
}) {
  if (columns.length === 0) {
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} title={title}
        placeholder="field" className={rowInputCls} style={{ ...rowInputSty, ...style }} />
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} title={title}
      className={`${rowInputCls} cursor-pointer`} style={{ ...rowInputSty, ...style }}>
      <option value="">Select a field…</option>
      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

/** Cube requires an explicit type on every dimension. */
function DimensionTypePicker({ value, onChange }: { value: DimensionType; onChange: (v: DimensionType) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as DimensionType)}
      className={`${rowInputCls} shrink-0 cursor-pointer`} style={{ ...rowInputSty, flex: "0 0 90px" }}>
      {DIMENSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

/** Optional display-formatting hint (Cube's `format:`) — purely how BI tools
 * render the value, e.g. as a currency or percentage. Doesn't change the data. */
function FormatPicker<F extends string>({
  value, onChange, options, title,
}: {
  value: F;
  onChange: (v: F) => void;
  options: { value: F; label: string }[];
  title: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as F)} title={title}
      className={`${rowInputCls} shrink-0 cursor-pointer`} style={{ ...rowInputSty, flex: "0 0 100px" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function RemoveRowButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-[var(--border)]">
      <FaTrash size={10} style={{ color: "var(--text)" }} />
    </button>
  );
}

function SectionHeader({
  label, count, collapsed, onToggleCollapse,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <button type="button" onClick={onToggleCollapse}
      className="mb-1.5 flex w-full items-center gap-1.5 rounded-md py-0.5 transition-colors hover:bg-[var(--border)]">
      {collapsed ? <FaChevronRight size={8} style={{ color: "var(--text)" }} /> : <FaChevronDown size={8} style={{ color: "var(--text)" }} />}
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
        {label}{count > 0 && <span className="ml-1 font-normal opacity-60">({count})</span>}
      </span>
    </button>
  );
}

/** "Add" button rendered below a section's rows, per request. */
function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      style={{ color: "var(--text)" }}>
      <FaPlus size={8} /> {label}
    </button>
  );
}

// ── Source card ──────────────────────────────────────────────────────────

interface SourceCardProps {
  index: number;
  source: WizardSource;
  connections: ConnectionPublicResponse[];
  connLoading: boolean;
  files: FilePublicResponse[];
  filesLoading: boolean;
  schemaOptions: string[];
  tableOptions: TableInfo[];
  columnOptions: string[];
  schemaLoading: boolean;
  tableLoading: boolean;
  canRemove: boolean;
  onUpdate: (patch: Partial<WizardSource>) => void;
  onSourceTypeChange: (sourceType: SourceType) => void;
  onConnectionChange: (connectionId: string) => void;
  onSchemaChange: (schema: string) => void;
  onTableChange: (table: string) => void;
  onFileChange: (fileId: string) => void;
  onRemove: () => void;
  onAddDimension: () => void;
  onUpdateDimension: (id: string, patch: Partial<WizardDimension>) => void;
  onRemoveDimension: (id: string) => void;
  onAddMeasure: () => void;
  onUpdateMeasure: (id: string, patch: Partial<WizardMeasure>) => void;
  onRemoveMeasure: (id: string) => void;
  onAddJoin: () => void;
  onUpdateJoin: (id: string, patch: Partial<WizardJoin>) => void;
  onRemoveJoin: (id: string) => void;
}

function SourceCard({
  index, source, connections, connLoading, files, filesLoading,
  schemaOptions, tableOptions, columnOptions, schemaLoading, tableLoading, canRemove,
  onUpdate, onSourceTypeChange, onConnectionChange, onSchemaChange, onTableChange, onFileChange, onRemove,
  onAddDimension, onUpdateDimension, onRemoveDimension,
  onAddMeasure, onUpdateMeasure, onRemoveMeasure,
  onAddJoin, onUpdateJoin, onRemoveJoin,
}: SourceCardProps) {
  const usingManualTable = source.sourceType === "connection" && schemaOptions.length === 0 && !source.schema;
  // Measures/primary key reference fields as they exist AFTER renames — the
  // original column name stops being a valid reference once renamed by a
  // column-mode dimension. `columnOptions` only has data once the table has
  // been (re-)introspected this session — for a source freshly loaded from
  // an existing YAML file it's empty, so fall back to the dimension names
  // already known from that file (same source the dimension rows themselves
  // render from) rather than showing primary key/measure pickers as blank.
  const knownFieldNames = source.dimensions
    .map((d) => (d.mode === "column" ? d.name.trim() || d.field.trim() : d.name.trim()))
    .filter(Boolean);
  const postRenameColumns = Array.from(new Set([...effectiveColumns(columnOptions, source.dimensions), ...knownFieldNames]));

  const [collapsed, setCollapsed] = useState(false);
  const [dimensionsOpen, setDimensionsOpen] = useState(true);
  const [measuresOpen, setMeasuresOpen] = useState(true);
  const [joinsOpen, setJoinsOpen] = useState(true);

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card, var(--bg))" }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setCollapsed((v) => !v)} className="flex items-center gap-1.5">
          {collapsed ? <FaChevronRight size={9} style={{ color: "var(--text)" }} /> : <FaChevronDown size={9} style={{ color: "var(--text)" }} />}
          <span className="text-xs font-bold" style={{ color: "var(--text-h)" }}>
            Source {index + 1}{source.name.trim() && ` — ${source.name.trim()}`}
          </span>
        </button>
        {canRemove && <RemoveRowButton onClick={onRemove} title="Remove source" />}
      </div>

      {collapsed ? null : (
      <>
      {/* Name + source type */}
      <div className="grid grid-cols-2 gap-3">
        <CTextInput label="Cube Name" value={source.name} onChange={(v) => onUpdate({ name: v })} placeholder="e.g. orders" required />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>Reads from</label>
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
            {(["connection", "file"] as SourceType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onSourceTypeChange(t)}
                className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-all"
                style={source.sourceType === t ? { background: "var(--accent)", color: "#fff" } : { color: "var(--text)" }}
              >
                {t === "connection" ? "Database Connection" : "Uploaded File"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {source.sourceType === "connection" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>Connection</label>
              <select
                value={source.connectionId}
                onChange={(e) => onConnectionChange(e.target.value)}
                disabled={connLoading}
                className={selectCls}
                style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
              >
                <option value="">{connLoading ? "Loading connections…" : "Select a connection"}</option>
                {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
                Schema {schemaLoading && <CSpinner size={10} />}
              </label>
              {schemaOptions.length > 0 ? (
                <select
                  value={source.schema}
                  onChange={(e) => onSchemaChange(e.target.value)}
                  className={selectCls}
                  style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
                >
                  <option value="">Select a schema</option>
                  {schemaOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <p className="rounded-xl border px-3.5 py-2.5 text-xs italic" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  {source.connectionId ? "No schemas found — enter the table path manually below." : "Pick a connection first."}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
              Table {tableLoading && <CSpinner size={10} />}
            </label>
            {tableOptions.length > 0 ? (
              <select
                value={source.tableRef}
                onChange={(e) => onTableChange(e.target.value)}
                className={selectCls}
                style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
              >
                <option value="">Select a table</option>
                {tableOptions.map((t) => <option key={t.resource} value={t.resource}>{t.resource}</option>)}
              </select>
            ) : (
              <p className="rounded-xl border px-3.5 py-2.5 text-xs italic" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                {source.schema ? "No tables found — enter the table path manually below." : "Pick a schema first."}
              </p>
            )}
          </div>

          {usingManualTable && (
            <CTextInput
              label="Table path"
              value={source.tableRef}
              onChange={(v) => onUpdate({ tableRef: v })}
              placeholder="e.g. public.orders"
              required
            />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
            File {filesLoading && <CSpinner size={10} />}
          </label>
          <select
            value={source.fileId}
            onChange={(e) => onFileChange(e.target.value)}
            disabled={filesLoading}
            className={selectCls}
            style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
          >
            <option value="">{filesLoading ? "Loading files…" : "Select an uploaded file"}</option>
            {files.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.extension})</option>)}
          </select>
          {files.length === 0 && !filesLoading && (
            <p className="text-[11px] italic opacity-60" style={{ color: "var(--text)" }}>
              No files uploaded yet — upload one from the Files page first.
            </p>
          )}
        </div>
      )}

      {source.tableRef && (
        <p className="text-[11px]" style={{ color: "var(--text)" }}>
          Reads: <span className="font-mono" style={{ color: "var(--text-h)" }}>
            {source.sourceType === "file" ? `read_${source.tableRef.toLowerCase().endsWith(".parquet") ? "parquet" : "csv"}('${source.tableRef}')` : source.tableRef}
          </span>
        </p>
      )}

      {/* Primary key (optional) — references fields as they exist after renames.
          Locked once the source is saved: changing it later would silently
          re-point joins/measures built against the old key, so a source
          that already has one must be removed and re-added instead. */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-h)" }}>
          Primary Key <span className="text-xs font-normal opacity-60">(optional)</span>
          {source.existing && <FaLock size={10} title="Locked once saved — remove and re-add this source to change it." style={{ color: "var(--text)" }} />}
        </label>
        <select
          value={source.primaryKey}
          onChange={(e) => {
            const primaryKey = e.target.value;
            // A primary key with no backing dimension never gets emitted as
            // `primary_key: true` in the generated YAML (nothing to attach
            // it to) — expose the raw column as one automatically.
            const hasDimension = source.dimensions.some((d) =>
              (d.mode === "column" ? d.name.trim() || d.field.trim() : d.name.trim()) === primaryKey,
            );
            const dimensions = !primaryKey || hasDimension
              ? source.dimensions
              : [...source.dimensions, { id: uid(), name: "", mode: "column" as DimensionMode, field: primaryKey, expression: "", type: "string" as DimensionType, format: "" as DimensionFormat }];
            onUpdate({ primaryKey, dimensions });
          }}
          disabled={source.existing || postRenameColumns.length === 0}
          title={source.existing ? "Primary key is locked once saved — remove and re-add this source to change it." : undefined}
          className={selectCls}
          style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
        >
          <option value="">{postRenameColumns.length === 0 ? "Pick a table first" : "None"}</option>
          {postRenameColumns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Dimensions — a raw column, or a computed SQL expression (Cube's `sql:` is raw SQL) */}
      <div>
        <SectionHeader label="Dimensions" count={source.dimensions.length} collapsed={!dimensionsOpen} onToggleCollapse={() => setDimensionsOpen((v) => !v)} />
        {dimensionsOpen && (
          <>
            <div className="flex flex-col gap-1.5">
              {source.dimensions.map((d) => {
                const effectiveName = d.mode === "column" ? d.name.trim() || d.field.trim() : d.name.trim();
                const pkLocked = source.existing && !!source.primaryKey && effectiveName === source.primaryKey;
                const pkLockTitle = "This dimension backs the primary key and is locked once saved — remove and re-add the source to change it.";
                return (
                <div key={d.id} className="flex items-center gap-1.5">
                  <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5" style={{ borderColor: "var(--border)" }}>
                    {(["column", "expression"] as DimensionMode[]).map((m) => (
                      <button key={m} type="button" onClick={() => onUpdateDimension(d.id, { mode: m })}
                        disabled={pkLocked} title={pkLocked ? pkLockTitle : undefined}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-all"
                        style={d.mode === m ? { background: "var(--accent-muted)", color: "var(--accent)" } : { color: "var(--text)" }}
                      >{m}</button>
                    ))}
                  </div>
                  {d.mode === "column" ? (
                    <FieldPicker value={d.field} onChange={(v) => onUpdateDimension(d.id, { field: v })} columns={columnOptions} disabled={pkLocked} title={pkLocked ? pkLockTitle : undefined} />
                  ) : (
                    <input value={d.expression} onChange={(e) => onUpdateDimension(d.id, { expression: e.target.value })}
                      placeholder="SQL expression, e.g. UPPER(status)" disabled={pkLocked} title={pkLocked ? pkLockTitle : undefined} className={rowInputCls} style={rowInputSty} />
                  )}
                  <span className="shrink-0 text-[10px] opacity-60" style={{ color: "var(--text)" }}>as</span>
                  <input value={d.name} onChange={(e) => onUpdateDimension(d.id, { name: e.target.value })}
                    placeholder={d.mode === "column" ? "title (optional)" : "title"} disabled={pkLocked} title={pkLocked ? pkLockTitle : undefined} className={rowInputCls} style={{ ...rowInputSty, flex: "0 0 25%" }} />
                  <DimensionTypePicker value={d.type} onChange={(v) => onUpdateDimension(d.id, { type: v })} />
                  <FormatPicker value={d.format} onChange={(v) => onUpdateDimension(d.id, { format: v })} options={DIMENSION_FORMATS} title="Display format" />
                  {pkLocked ? (
                    <span className="shrink-0 rounded-md p-1.5" title={pkLockTitle}>
                      <FaLock size={10} style={{ color: "var(--text)" }} />
                    </span>
                  ) : (
                    <RemoveRowButton onClick={() => onRemoveDimension(d.id)} title="Remove dimension" />
                  )}
                </div>
                );
              })}
              {source.dimensions.length === 0 && (
                <p className="text-[11px] italic opacity-60" style={{ color: "var(--text)" }}>No dimensions yet.</p>
              )}
            </div>
            <AddRowButton onClick={onAddDimension} label="Add dimension" />
          </>
        )}
      </div>

      {/* Measures — reference fields as they exist after renames */}
      <div>
        <SectionHeader label="Measures" count={source.measures.length} collapsed={!measuresOpen} onToggleCollapse={() => setMeasuresOpen((v) => !v)} />
        {measuresOpen && (
          <>
        <div className="flex flex-col gap-1.5">
          {source.measures.map((m) => (
            <div key={m.id} className="flex flex-col gap-1 rounded-lg border p-1.5" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1.5">
                <input value={m.name} onChange={(e) => onUpdateMeasure(m.id, { name: e.target.value })}
                  placeholder="name" className={rowInputCls} style={{ ...rowInputSty, flex: "0 0 40%" }} />
                <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5" style={{ borderColor: "var(--border)" }}>
                  {(["function", "expression"] as MeasureKind[]).map((k) => (
                    <button key={k} type="button" onClick={() => onUpdateMeasure(m.id, { kind: k })}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-all"
                      style={m.kind === k ? { background: "var(--accent-muted)", color: "var(--accent)" } : { color: "var(--text)" }}
                    >{k}</button>
                  ))}
                </div>
                <RemoveRowButton onClick={() => onRemoveMeasure(m.id)} title="Remove measure" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[10px] opacity-60" style={{ color: "var(--text)" }}>is</span>
                {m.kind === "expression" ? (
                  <input value={m.expression} onChange={(e) => onUpdateMeasure(m.id, { expression: e.target.value })}
                    placeholder="e.g. {total_revenue} - {total_cost} — references other measure names" className={rowInputCls} style={rowInputSty} />
                ) : (
                  <>
                    <select value={m.fn} onChange={(e) => onUpdateMeasure(m.id, { fn: e.target.value as AggFn })}
                      className={`${rowInputCls} shrink-0 cursor-pointer`} style={{ ...rowInputSty, flex: "0 0 90px" }}>
                      {AGG_FNS.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                    <FieldPicker value={m.field} onChange={(v) => onUpdateMeasure(m.id, { field: v })} columns={postRenameColumns} />
                  </>
                )}
                <FormatPicker value={m.format} onChange={(v) => onUpdateMeasure(m.id, { format: v })} options={MEASURE_FORMATS} title="Display format" />
              </div>
            </div>
          ))}
          {source.measures.length === 0 && (
            <p className="text-[11px] italic opacity-60" style={{ color: "var(--text)" }}>No measures yet.</p>
          )}
        </div>
        <AddRowButton onClick={onAddMeasure} label="Add measure" />
          </>
        )}
      </div>

      {/* Joins */}
      <div>
        <SectionHeader label="Joins" count={source.joins.length} collapsed={!joinsOpen} onToggleCollapse={() => setJoinsOpen((v) => !v)} />
        {joinsOpen && (
          <>
            <div className="flex flex-col gap-1.5">
              {source.joins.map((j) => (
                <div key={j.id} className="flex items-center gap-1.5">
                  <select value={j.relationship} onChange={(e) => onUpdateJoin(j.id, { relationship: e.target.value as JoinRelationship })}
                    title={JOIN_RELATIONSHIPS.find((k) => k.value === j.relationship)?.hint}
                    className={`${rowInputCls} shrink-0 cursor-pointer`} style={{ ...rowInputSty, flex: "0 0 110px" }}>
                    {JOIN_RELATIONSHIPS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input value={j.targetSource} onChange={(e) => onUpdateJoin(j.id, { targetSource: e.target.value })}
                    placeholder="target cube name" className={rowInputCls} style={{ ...rowInputSty, flex: "0 0 25%" }} />
                  <span className="shrink-0 text-[10px] opacity-60" style={{ color: "var(--text)" }}>on</span>
                  <input value={j.on} onChange={(e) => onUpdateJoin(j.id, { on: e.target.value })}
                    placeholder={`{CUBE}.id = {${j.targetSource || "target"}}.foreign_id`} className={rowInputCls} style={rowInputSty} />
                  <RemoveRowButton onClick={() => onRemoveJoin(j.id)} title="Remove join" />
                </div>
              ))}
              {source.joins.length === 0 && (
                <p className="text-[11px] italic opacity-60" style={{ color: "var(--text)" }}>No joins yet.</p>
              )}
            </div>
            <AddRowButton onClick={onAddJoin} label="Add join" />
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}

// ── Wizard ───────────────────────────────────────────────────────────────

interface CubeDefinitionWizardProps {
  /** Existing code to load into the builder when it's opened — parsed once on mount. */
  initialCode?: string;
  /** Called with the generated `.yml` text whenever the builder's state changes. */
  onChange: (cubeYaml: string) => void;
}

export default function CubeDefinitionWizard({ initialCode = "", onChange }: CubeDefinitionWizardProps) {
  const [sources, setSources] = useState<WizardSource[]>(() => parseCubeYamlToSources(initialCode));

  const [connections, setConnections] = useState<ConnectionPublicResponse[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [connError, setConnError] = useState("");

  const [files, setFiles] = useState<FilePublicResponse[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState("");

  const [schemaOptions, setSchemaOptions] = useState<Record<string, string[]>>({});
  const [tableOptions, setTableOptions] = useState<Record<string, TableInfo[]>>({});
  const [columnOptions, setColumnOptions] = useState<Record<string, string[]>>({});
  const [schemaLoading, setSchemaLoading] = useState<Record<string, boolean>>({});
  const [tableLoading, setTableLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getConnections()
      .then(setConnections)
      .catch((e: Error) => setConnError(e.message ?? "Failed to load connections."))
      .finally(() => setConnLoading(false));
    getFiles()
      .then(setFiles)
      .catch((e: Error) => setFilesError(e.message ?? "Failed to load files."))
      .finally(() => setFilesLoading(false));
  }, []);

  // Sources parsed from initialCode only have a connectionName/fileId-less
  // path, since the connection/file lists hadn't loaded yet — backfill the
  // real IDs once they have, so the dropdowns show the right selection.
  // Runs once; later connection/file list changes don't re-trigger it.
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (backfilledRef.current || connLoading || filesLoading) return;
    backfilledRef.current = true;
    setSources((prev) => prev.map((s) => {
      if (s.sourceType === "connection" && !s.connectionId && s.connectionName) {
        const conn = connections.find((c) => c.name === s.connectionName);
        if (conn) return { ...s, connectionId: conn.id };
      }
      if (s.sourceType === "file" && !s.fileId && s.tableRef) {
        const file = files.find((f) => fileTableRef(f) === s.tableRef);
        if (file) return { ...s, fileId: file.id };
      }
      return s;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connLoading, filesLoading]);

  function updateSource(id: string, patch: Partial<WizardSource>) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSource() {
    setSources((prev) => [...prev, newWizardSource()]);
  }

  function removeSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSourceTypeChange(source: WizardSource, sourceType: SourceType) {
    if (sourceType === source.sourceType) return;
    updateSource(source.id, {
      sourceType,
      connectionId: "", connectionName: "", schema: "", fileId: "", tableRef: "",
    });
    setColumnOptions((prev) => ({ ...prev, [source.id]: [] }));
  }

  async function handleConnectionChange(source: WizardSource, connectionId: string) {
    const conn = connections.find((c) => c.id === connectionId);
    updateSource(source.id, { connectionId, connectionName: conn?.name ?? "", schema: "", tableRef: "" });
    setSchemaOptions((prev) => ({ ...prev, [source.id]: [] }));
    setTableOptions((prev) => ({ ...prev, [source.id]: [] }));
    setColumnOptions((prev) => ({ ...prev, [source.id]: [] }));
    if (!connectionId) return;

    setSchemaLoading((prev) => ({ ...prev, [source.id]: true }));
    try {
      const schemas = await getConnectionSchemas(connectionId);
      setSchemaOptions((prev) => ({ ...prev, [source.id]: normalizeSchemas(schemas) }));
    } catch {
      // Introspection is a convenience, not a requirement — the manual table-path
      // input below always covers this case if introspection fails.
    } finally {
      setSchemaLoading((prev) => ({ ...prev, [source.id]: false }));
    }
  }

  async function handleSchemaChange(source: WizardSource, schema: string) {
    updateSource(source.id, { schema, tableRef: "" });
    setTableOptions((prev) => ({ ...prev, [source.id]: [] }));
    setColumnOptions((prev) => ({ ...prev, [source.id]: [] }));
    if (!schema) return;

    setTableLoading((prev) => ({ ...prev, [source.id]: true }));
    try {
      const tables = await getSchemaTables(source.connectionId, schema);
      setTableOptions((prev) => ({ ...prev, [source.id]: normalizeTables(tables) }));
    } catch {
      // same fallback as handleConnectionChange
    } finally {
      setTableLoading((prev) => ({ ...prev, [source.id]: false }));
    }
  }

  function handleTableChange(source: WizardSource, table: string) {
    // `table` here is already the introspection endpoint's fully-qualified
    // `resource` (e.g. "public.orders") — no need to re-prefix with the schema.
    updateSource(source.id, { tableRef: table });
    const matched = (tableOptions[source.id] ?? []).find((t) => t.resource === table);
    setColumnOptions((prev) => ({ ...prev, [source.id]: matched?.columns ?? [] }));
  }

  async function handleFileChange(source: WizardSource, fileId: string) {
    const file = files.find((f) => f.id === fileId);
    if (!file) {
      updateSource(source.id, { fileId: "", connectionName: "", tableRef: "" });
      setColumnOptions((prev) => ({ ...prev, [source.id]: [] }));
      return;
    }
    updateSource(source.id, {
      fileId,
      connectionName: "duckdb",
      tableRef: fileTableRef(file),
    });
    setColumnOptions((prev) => ({ ...prev, [source.id]: [] }));
    try {
      const schema = await getFileSchema(fileId);
      setColumnOptions((prev) => ({ ...prev, [source.id]: schema.columns.map((c) => c.name) }));
    } catch {
      // Same fallback as the connection path — FieldPicker degrades to free text.
    }
  }

  function addDimension(source: WizardSource) {
    updateSource(source.id, { dimensions: [...source.dimensions, { id: uid(), name: "", mode: "column", field: "", expression: "", type: "string", format: "" }] });
  }
  function updateDimension(source: WizardSource, id: string, patch: Partial<WizardDimension>) {
    updateSource(source.id, { dimensions: source.dimensions.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  }
  function removeDimension(source: WizardSource, id: string) {
    updateSource(source.id, { dimensions: source.dimensions.filter((d) => d.id !== id) });
  }

  function addMeasure(source: WizardSource) {
    updateSource(source.id, { measures: [...source.measures, { id: uid(), name: "", kind: "function", fn: "count", field: "", expression: "", format: "" }] });
  }
  function updateMeasure(source: WizardSource, id: string, patch: Partial<WizardMeasure>) {
    updateSource(source.id, { measures: source.measures.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  }
  function removeMeasure(source: WizardSource, id: string) {
    updateSource(source.id, { measures: source.measures.filter((m) => m.id !== id) });
  }

  function addJoin(source: WizardSource) {
    updateSource(source.id, { joins: [...source.joins, { id: uid(), relationship: "many_to_one", targetSource: "", on: "" }] });
  }
  function updateJoin(source: WizardSource, id: string, patch: Partial<WizardJoin>) {
    updateSource(source.id, { joins: source.joins.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
  }
  function removeJoin(source: WizardSource, id: string) {
    updateSource(source.id, { joins: source.joins.filter((j) => j.id !== id) });
  }

  const generated = generateCubeYaml(sources);

  // Keep the Code tab's content live-synced with the builder — but only once
  // the builder's output actually differs from what it produced at mount, so
  // simply opening this tab never clobbers existing code before the user has
  // changed anything here. Seeded during render (not in an effect) so this
  // survives React StrictMode's dev-only double-invoke of effect setup on
  // mount — a ref-flag guard would get silently reset by that and fire early.
  const lastAnnouncedRef = useRef<string | undefined>(undefined);
  if (lastAnnouncedRef.current === undefined) {
    lastAnnouncedRef.current = generated;
  }
  useEffect(() => {
    if (generated === lastAnnouncedRef.current) return;
    lastAnnouncedRef.current = generated;
    onChange(generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generated]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {connError && <CAlert variant="error" message={connError} />}
      {filesError && <CAlert variant="error" message={filesError} />}
      {sources.map((source, idx) => (
        <SourceCard
          key={source.id}
          index={idx}
          source={source}
          connections={connections}
          connLoading={connLoading}
          files={files}
          filesLoading={filesLoading}
          schemaOptions={schemaOptions[source.id] ?? []}
          tableOptions={tableOptions[source.id] ?? []}
          columnOptions={columnOptions[source.id] ?? []}
          schemaLoading={!!schemaLoading[source.id]}
          tableLoading={!!tableLoading[source.id]}
          canRemove={sources.length > 1}
          onUpdate={(patch) => updateSource(source.id, patch)}
          onSourceTypeChange={(t) => handleSourceTypeChange(source, t)}
          onConnectionChange={(v) => handleConnectionChange(source, v)}
          onSchemaChange={(v) => handleSchemaChange(source, v)}
          onTableChange={(v) => handleTableChange(source, v)}
          onFileChange={(v) => handleFileChange(source, v)}
          onRemove={() => removeSource(source.id)}
          onAddDimension={() => addDimension(source)}
          onUpdateDimension={(id, patch) => updateDimension(source, id, patch)}
          onRemoveDimension={(id) => removeDimension(source, id)}
          onAddMeasure={() => addMeasure(source)}
          onUpdateMeasure={(id, patch) => updateMeasure(source, id, patch)}
          onRemoveMeasure={(id) => removeMeasure(source, id)}
          onAddJoin={() => addJoin(source)}
          onUpdateJoin={(id, patch) => updateJoin(source, id, patch)}
          onRemoveJoin={(id) => removeJoin(source, id)}
        />
      ))}
      <CButton variant="outline" onClick={addSource}>
        <FaPlus size={11} /> Add Source
      </CButton>
    </div>
  );
}
