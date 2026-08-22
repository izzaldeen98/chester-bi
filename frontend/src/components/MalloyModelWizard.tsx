import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FaPlus, FaTrash, FaChevronDown, FaChevronRight } from "react-icons/fa";
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

export type JoinKind = "join_one" | "join_many" | "join_cross";
export type AggFn = "count" | "sum" | "avg" | "min" | "max";
export type SourceType = "connection" | "file";

/** A plain rename of an existing column — no computation, `rename: name is field`. */
export interface WizardAlias { id: string; name: string; field: string }
/** A real computed field — always a free-form expression, `dimension: name is expression`. */
export interface WizardDimension { id: string; name: string; expression: string }
export type MeasureKind = "function" | "expression";
export interface WizardMeasure { id: string; name: string; kind: MeasureKind; fn: AggFn; field: string; expression: string }
/** Malloy joins don't need a separate alias — `join_kind: targetSource on condition`
 * both names and references the join by the target source's own name. */
export interface WizardJoin { id: string; kind: JoinKind; targetSource: string; on: string }

/**
 * A Malloy composite source (`source: name is compose(a, b, ...)`) — per
 * https://docs.malloydata.dev/documentation/experiments/composite_sources,
 * `members` is priority order: for a given query, Malloy picks the first
 * listed member whose own definitions cover every field the query uses.
 * This does NOT merge rows across members like a join — it lets one query
 * surface resolve against whichever single source actually has the fields.
 */
export interface WizardComposite { id: string; name: string; members: string[] }

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
  // resolved table reference passed to `<connection>.table('...')` either way
  tableRef: string;
  /** Optional — Malloy doesn't require one, mainly matters for join correctness */
  primaryKey: string;
  aliases: WizardAlias[];
  dimensions: WizardDimension[];
  measures: WizardMeasure[];
  joins: WizardJoin[];
}

/** Raw table columns with any renamed ones swapped for their new name — once a
 * column is renamed, only the new name is a valid field reference downstream
 * (measures, primary key, further expressions), the old one no longer exists. */
function effectiveColumns(columns: string[], aliases: WizardAlias[]): string[] {
  return columns.map((c) => {
    const alias = aliases.find((a) => a.name.trim() && a.field.trim() === c);
    return alias ? alias.name.trim() : c;
  });
}

const AGG_FNS: AggFn[] = ["count", "sum", "avg", "min", "max"];
const JOIN_KINDS: { value: JoinKind; label: string; hint: string }[] = [
  { value: "join_one", label: "Join One", hint: "at most one matching row (foreign-key style)" },
  { value: "join_many", label: "Join Many", hint: "one row here can match many rows there" },
  { value: "join_cross", label: "Join Cross", hint: "cross join, every combination" },
];

// Files live in the same shared volume the publisher container mounts at
// /publisher/publisher_data (see docker-compose.yml) — File.path already
// starts with "publisher_data/…", so this is the exact path the publisher's
// duckdb dialect needs to read the file directly.
const PUBLISHER_VOLUME_ROOT = "/publisher";

function uid() {
  return Math.random().toString(36).slice(2);
}

/** Backtick-quoting is always valid Malloy syntax — quote unconditionally so a
 * name that happens to be a reserved word (e.g. `Date`) never breaks compilation. */
function quoteIdent(raw: string): string {
  return `\`${raw}\``;
}

// ── Publisher response normalizers ──────────────────────────────────────
// Confirmed against a live publisher: schemas are `{name, isHidden, isDefault}`,
// tables are `{resource, columns}` — NOT `{name}` — so they need separate
// extraction, not one shared "guess the label key" helper.

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
    aliases: [],
    dimensions: [],
    measures: [],
    joins: [],
  };
}

export function newWizardComposite(): WizardComposite {
  return { id: uid(), name: "", members: [] };
}

/** Generates a `.malloy` source block per configured source — the only place Malloy syntax gets built. */
export function generateMalloy(sources: WizardSource[]): string {
  return sources
    .filter((s) => s.name.trim() && s.tableRef.trim())
    .map((s) => {
      const lines: string[] = [];
      lines.push(
        `source: ${quoteIdent(s.name.trim())} is ${s.connectionName || "connection_name"}.table('${s.tableRef.trim()}') extend {`,
      );

      // If the primary-key column got renamed via an alias below, point
      // primary_key at the new name — the old column name won't exist anymore.
      let primaryKey = s.primaryKey.trim();
      if (primaryKey) {
        const renamedTo = s.aliases.find((a) => a.name.trim() && a.field.trim() === primaryKey);
        if (renamedTo) primaryKey = renamedTo.name.trim();
        lines.push(`  primary_key: ${quoteIdent(primaryKey)}`);
      }

      for (const a of s.aliases) {
        if (!a.name.trim() || !a.field.trim()) continue;
        lines.push(`  rename: ${quoteIdent(a.name.trim())} is ${quoteIdent(a.field.trim())}`);
      }
      for (const d of s.dimensions) {
        if (!d.name.trim() || !d.expression.trim()) continue;
        lines.push(`  dimension: ${quoteIdent(d.name.trim())} is ${d.expression.trim()}`);
      }
      for (const m of s.measures) {
        if (!m.name.trim()) continue;
        if (m.kind === "expression") {
          if (!m.expression.trim()) continue;
          lines.push(`  measure: ${quoteIdent(m.name.trim())} is ${m.expression.trim()}`);
        } else {
          if (!m.field.trim()) continue;
          lines.push(`  measure: ${quoteIdent(m.name.trim())} is ${m.fn}(${quoteIdent(m.field.trim())})`);
        }
      }
      for (const j of s.joins) {
        if (!j.targetSource.trim()) continue;
        const onClause = j.on.trim() ? ` on ${j.on.trim()}` : "";
        lines.push(`  ${j.kind}: ${quoteIdent(j.targetSource.trim())}${onClause}`);
      }
      lines.push("}");
      return lines.join("\n");
    })
    .join("\n\n");
}

/** Generates one `source: name is compose(a, b, ...)` line per configured
 * composite — the priority-ordered wrapper `docs/experiments/composite_sources`
 * describes for letting a query resolve against whichever member source
 * actually has the fields it selected. `compose()` is gated behind Malloy's
 * `composite_sources` experiment flag — without the pragma the compiler
 * rejects it outright, so it's emitted once up front whenever any composite
 * is defined. */
export function generateCompositeMalloy(composites: WizardComposite[]): string {
  const valid = composites.filter((c) => c.name.trim() && c.members.filter((m) => m.trim()).length >= 2);
  if (valid.length === 0) return "";

  const blocks = valid.map((c) => {
    const members = c.members.filter((m) => m.trim()).map((m) => quoteIdent(m.trim()));
    return `source: ${quoteIdent(c.name.trim())} is compose(${members.join(", ")})`;
  });

  return ["##! experimental { composite_sources }", ...blocks].join("\n\n");
}

const JOIN_KIND_VALUES = new Set<JoinKind>(["join_one", "join_many", "join_cross"]);
const AGG_FN_VALUES = new Set<AggFn>(["count", "sum", "avg", "min", "max"]);

function unquoteIdent(raw: string): string {
  return raw.replace(/^`|`$/g, "");
}

/**
 * Matches `fnName(...)` only when the parens right after `fnName` are balanced
 * AND their matching close is the very last character — i.e. the whole string
 * really is one wrapped call, not e.g. "sum(revenue) - sum(cost)" (a greedy
 * `^(\w+)\((.*)\)$` regex would wrongly treat that as a single call).
 */
function matchSimpleFnCall(text: string): { fn: string; field: string } | null {
  const head = text.match(/^(\w+)\(/);
  if (!head) return null;
  const openIdx = head[0].length - 1;
  let depth = 1;
  let i = openIdx + 1;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
  }
  if (depth !== 0 || i !== text.length) return null;
  return { fn: head[1], field: text.slice(openIdx + 1, i - 1) };
}

/**
 * Parses the subset of Malloy this wizard itself generates back into
 * structured sources — `source: name is conn.table('ref') extend { ... }`
 * blocks containing plain `dimension:`/`measure:`/`join_*:` lines. Anything
 * outside that shape (views, nested sources, multi-line expressions, hand
 * written extras) is simply not recognized and left out of the builder —
 * this is a best-effort round-trip for wizard-shaped code, not a full
 * Malloy parser.
 */
export function parseMalloyToSources(text: string): WizardSource[] {
  if (!text || !text.trim()) return [newWizardSource()];

  const sources: WizardSource[] = [];
  const headerRe = /source:\s*(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s+is\s+([A-Za-z_][A-Za-z0-9_]*)\.table\('([^']*)'\)\s*extend\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(text)) !== null) {
    const connectionName = match[2];
    const tableRef = match[3];
    const bodyStart = headerRe.lastIndex;

    // Find the matching closing brace by depth counting (handles any nested
    // `{}` inside, e.g. a hand-added calculate block, without misreading it).
    let depth = 1;
    let i = bodyStart;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
    }
    const body = text.slice(bodyStart, i - 1);
    headerRe.lastIndex = i; // resume scanning after this block

    const source: WizardSource = {
      ...newWizardSource(),
      name: unquoteIdent(match[1]),
      sourceType: connectionName === "duckdb" ? "file" : "connection",
      connectionName,
      tableRef,
    };

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      const pk = line.match(/^primary_key:\s*(\S+)\s*$/);
      if (pk) {
        source.primaryKey = unquoteIdent(pk[1]);
        continue;
      }

      const alias = line.match(/^rename:\s*(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s+is\s+(\S+)\s*$/);
      if (alias) {
        source.aliases.push({ id: uid(), name: unquoteIdent(alias[1]), field: unquoteIdent(alias[2].trim()) });
        continue;
      }

      const dim = line.match(/^dimension:\s*(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s+is\s+(.+)$/);
      if (dim) {
        source.dimensions.push({ id: uid(), name: unquoteIdent(dim[1]), expression: dim[2].trim() });
        continue;
      }

      // A measure is either `fn(field)` (a plain aggregate over one column) or
      // any other expression — the latter round-trips as a "expression" measure.
      const measure = line.match(/^measure:\s*(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s+is\s+(.+)$/);
      if (measure) {
        const name = unquoteIdent(measure[1]);
        const rest = measure[2].trim();
        const fnCall = matchSimpleFnCall(rest);
        if (fnCall && AGG_FN_VALUES.has(fnCall.fn as AggFn)) {
          source.measures.push({
            id: uid(),
            name,
            kind: "function",
            fn: fnCall.fn as AggFn,
            field: unquoteIdent(fnCall.field.trim()),
            expression: "",
          });
        } else {
          source.measures.push({ id: uid(), name, kind: "expression", fn: "count", field: "", expression: rest });
        }
        continue;
      }

      // `join_kind: target on condition` — also tolerates the older
      // `join_kind: name is target on condition` shape (the alias is dropped;
      // Malloy joins don't need one, the target's own name is the reference).
      const join = line.match(/^(join_one|join_many|join_cross):\s*(?:(?:`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s+is\s+)?(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)(?:\s+on\s+(.+))?$/);
      if (join && JOIN_KIND_VALUES.has(join[1] as JoinKind)) {
        source.joins.push({
          id: uid(),
          kind: join[1] as JoinKind,
          targetSource: unquoteIdent(join[2].trim()),
          on: (join[3] ?? "").trim(),
        });
      }
    }

    sources.push(source);
  }

  return sources.length > 0 ? sources : [newWizardSource()];
}

/**
 * Parses `source: name is compose(a, b, ...) [extend { ... }]` blocks back
 * into structured composites. An `extend` body (for composite-level extra
 * defs) is skipped over, not parsed — this wizard only edits the member list,
 * so any hand-written extend content wouldn't round-trip through it anyway.
 */
export function parseMalloyToComposites(text: string): WizardComposite[] {
  if (!text || !text.trim()) return [];

  const composites: WizardComposite[] = [];
  const headerRe = /source:\s*(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\s+is\s+compose\(([^)]*)\)\s*(extend\s*\{)?/g;

  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(text)) !== null) {
    const name = unquoteIdent(match[1]);
    const members = match[2]
      .split(",")
      .map((m) => unquoteIdent(m.trim()))
      .filter(Boolean);

    if (match[3]) {
      // Skip past the matching closing brace of the extend block.
      let depth = 1;
      let i = headerRe.lastIndex;
      for (; i < text.length && depth > 0; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
      }
      headerRe.lastIndex = i;
    }

    composites.push({ id: uid(), name, members });
  }

  return composites;
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
  value, onChange, columns, style,
}: {
  value: string;
  onChange: (v: string) => void;
  columns: string[];
  style?: CSSProperties;
}) {
  if (columns.length === 0) {
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="field" className={rowInputCls} style={{ ...rowInputSty, ...style }} />
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`${rowInputCls} cursor-pointer`} style={{ ...rowInputSty, ...style }}>
      <option value="">Select a field…</option>
      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
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
  onAddAlias: () => void;
  onUpdateAlias: (id: string, patch: Partial<WizardAlias>) => void;
  onRemoveAlias: (id: string) => void;
  onAddDimension: () => void;
  onUpdateDimension: (id: string, patch: Partial<WizardDimension>) => void;
  onRemoveDimension: (id: string) => void;
  onAddMeasure: () => void;
  onUpdateMeasure: (id: string, patch: Partial<WizardMeasure>) => void;
  onRemoveMeasure: (id: string) => void;
  onAddJoin: () => void;
  onUpdateJoin: (id: string, patch: Partial<WizardJoin>) => void;
  onRemoveJoin: (id: string) => void;
  onComposeWithJoins: () => void;
}

function SourceCard({
  index, source, connections, connLoading, files, filesLoading,
  schemaOptions, tableOptions, columnOptions, schemaLoading, tableLoading, canRemove,
  onUpdate, onSourceTypeChange, onConnectionChange, onSchemaChange, onTableChange, onFileChange, onRemove,
  onAddAlias, onUpdateAlias, onRemoveAlias,
  onAddDimension, onUpdateDimension, onRemoveDimension,
  onAddMeasure, onUpdateMeasure, onRemoveMeasure,
  onAddJoin, onUpdateJoin, onRemoveJoin, onComposeWithJoins,
}: SourceCardProps) {
  const usingManualTable = source.sourceType === "connection" && schemaOptions.length === 0 && !source.schema;
  // Measures/primary key reference fields as they exist AFTER renames — the
  // original column name stops being a valid reference once aliased.
  const postAliasColumns = effectiveColumns(columnOptions, source.aliases);

  const [collapsed, setCollapsed] = useState(false);
  const [aliasesOpen, setAliasesOpen] = useState(true);
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
        <CTextInput label="Source Name" value={source.name} onChange={(v) => onUpdate({ name: v })} placeholder="e.g. orders" required />

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
          Reads: <span className="font-mono" style={{ color: "var(--text-h)" }}>{source.connectionName}.table('{source.tableRef}')</span>
        </p>
      )}

      {/* Primary key (optional) — references fields as they exist after renames */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
          Primary Key <span className="text-xs font-normal opacity-60">(optional)</span>
        </label>
        <select
          value={source.primaryKey}
          onChange={(e) => onUpdate({ primaryKey: e.target.value })}
          disabled={postAliasColumns.length === 0}
          className={selectCls}
          style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
        >
          <option value="">{postAliasColumns.length === 0 ? "Pick a table first" : "None"}</option>
          {postAliasColumns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Aliases — plain renames of a raw column, no computation */}
      <div>
        <SectionHeader label="Aliases" count={source.aliases.length} collapsed={!aliasesOpen} onToggleCollapse={() => setAliasesOpen((v) => !v)} />
        {aliasesOpen && (
          <>
            <div className="flex flex-col gap-1.5">
              {source.aliases.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5">
                  <input value={a.name} onChange={(e) => onUpdateAlias(a.id, { name: e.target.value })}
                    placeholder="new name" className={rowInputCls} style={{ ...rowInputSty, flex: "0 0 30%" }} />
                  <span className="shrink-0 text-[10px] opacity-60" style={{ color: "var(--text)" }}>is</span>
                  <FieldPicker value={a.field} onChange={(v) => onUpdateAlias(a.id, { field: v })} columns={columnOptions} />
                  <RemoveRowButton onClick={() => onRemoveAlias(a.id)} title="Remove alias" />
                </div>
              ))}
              {source.aliases.length === 0 && (
                <p className="text-[11px] italic opacity-60" style={{ color: "var(--text)" }}>No aliases yet.</p>
              )}
            </div>
            <AddRowButton onClick={onAddAlias} label="Add alias" />
          </>
        )}
      </div>

      {/* Dimensions — always a real computed expression, never a plain field picker */}
      <div>
        <SectionHeader label="Dimensions" count={source.dimensions.length} collapsed={!dimensionsOpen} onToggleCollapse={() => setDimensionsOpen((v) => !v)} />
        {dimensionsOpen && (
          <>
            <div className="flex flex-col gap-1.5">
              {source.dimensions.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5">
                  <input value={d.name} onChange={(e) => onUpdateDimension(d.id, { name: e.target.value })}
                    placeholder="name" className={rowInputCls} style={{ ...rowInputSty, flex: "0 0 30%" }} />
                  <span className="shrink-0 text-[10px] opacity-60" style={{ color: "var(--text)" }}>is</span>
                  <input value={d.expression} onChange={(e) => onUpdateDimension(d.id, { expression: e.target.value })}
                    placeholder="expression, e.g. upper(status)" className={rowInputCls} style={rowInputSty} />
                  <RemoveRowButton onClick={() => onRemoveDimension(d.id)} title="Remove dimension" />
                </div>
              ))}
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
                    placeholder="expression, e.g. sum(revenue) - sum(cost)" className={rowInputCls} style={rowInputSty} />
                ) : (
                  <>
                    <select value={m.fn} onChange={(e) => onUpdateMeasure(m.id, { fn: e.target.value as AggFn })}
                      className={`${rowInputCls} shrink-0 cursor-pointer`} style={{ ...rowInputSty, flex: "0 0 90px" }}>
                      {AGG_FNS.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                    <FieldPicker value={m.field} onChange={(v) => onUpdateMeasure(m.id, { field: v })} columns={postAliasColumns} />
                  </>
                )}
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
        <div className="flex items-center justify-between">
          <SectionHeader label="Joins" count={source.joins.length} collapsed={!joinsOpen} onToggleCollapse={() => setJoinsOpen((v) => !v)} />
          {source.joins.length > 0 && (
            <button
              type="button"
              onClick={onComposeWithJoins}
              title="Create a composite source combining this source with its joined sources, per Malloy's composite-sources experiment — lets a query resolve fields from whichever one actually has them, queried independently rather than merged via the join."
              className="mb-1.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
              style={{ color: "var(--text)" }}
            >
              Compose with joins
            </button>
          )}
        </div>
        {joinsOpen && (
          <>
            <div className="flex flex-col gap-1.5">
              {source.joins.map((j) => (
                <div key={j.id} className="flex items-center gap-1.5">
                  <select value={j.kind} onChange={(e) => onUpdateJoin(j.id, { kind: e.target.value as JoinKind })}
                    title={JOIN_KINDS.find((k) => k.value === j.kind)?.hint}
                    className={`${rowInputCls} shrink-0 cursor-pointer`} style={{ ...rowInputSty, flex: "0 0 110px" }}>
                    {JOIN_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input value={j.targetSource} onChange={(e) => onUpdateJoin(j.id, { targetSource: e.target.value })}
                    placeholder="target source" className={rowInputCls} style={{ ...rowInputSty, flex: "0 0 30%" }} />
                  <span className="shrink-0 text-[10px] opacity-60" style={{ color: "var(--text)" }}>on</span>
                  <input value={j.on} onChange={(e) => onUpdateJoin(j.id, { on: e.target.value })}
                    placeholder="condition" className={rowInputCls} style={rowInputSty} />
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

// ── Composite source card ─────────────────────────────────────────────────

interface CompositeCardProps {
  composite: WizardComposite;
  sourceNames: string[];
  onUpdate: (patch: Partial<WizardComposite>) => void;
  onRemove: () => void;
  onAddMember: () => void;
  onUpdateMember: (index: number, value: string) => void;
  onRemoveMember: (index: number) => void;
}

/** Members are priority order — the select for member N excludes names
 * already chosen for earlier members so the same source can't be listed twice. */
function CompositeCard({
  composite, sourceNames, onUpdate, onRemove, onAddMember, onUpdateMember, onRemoveMember,
}: CompositeCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card, var(--bg))" }}>
      <div className="flex items-center justify-between">
        <CTextInput
          label="Composite Name"
          value={composite.name}
          onChange={(v) => onUpdate({ name: v })}
          placeholder="e.g. orders_composite"
          required
        />
        <RemoveRowButton onClick={onRemove} title="Remove composite source" />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
          Members <span className="ml-1 font-normal opacity-60">— priority order, first that has every queried field wins</span>
        </label>
        <div className="flex flex-col gap-1.5">
          {composite.members.map((member, idx) => {
            const takenByOthers = new Set(composite.members.filter((_, i) => i !== idx));
            const options = sourceNames.filter((n) => n === member || !takenByOthers.has(n));
            return (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-5 shrink-0 text-[10px] opacity-60" style={{ color: "var(--text)" }}>{idx + 1}.</span>
                <select
                  value={member}
                  onChange={(e) => onUpdateMember(idx, e.target.value)}
                  className={`${rowInputCls} cursor-pointer`}
                  style={rowInputSty}
                >
                  <option value="">Select a source…</option>
                  {options.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <RemoveRowButton onClick={() => onRemoveMember(idx)} title="Remove member" />
              </div>
            );
          })}
          {composite.members.length === 0 && (
            <p className="text-[11px] italic opacity-60" style={{ color: "var(--text)" }}>No members yet — add at least two.</p>
          )}
        </div>
        <AddRowButton onClick={onAddMember} label="Add member" />
      </div>
    </div>
  );
}

// ── Wizard ───────────────────────────────────────────────────────────────

interface MalloyModelWizardProps {
  /** Existing code to load into the builder when it's opened — parsed once on mount. */
  initialCode?: string;
  /** Called with the generated `.malloy` text whenever the builder's state changes. */
  onChange: (malloyCode: string) => void;
}

export default function MalloyModelWizard({ initialCode = "", onChange }: MalloyModelWizardProps) {
  const [sources, setSources] = useState<WizardSource[]>(() => parseMalloyToSources(initialCode));
  const [composites, setComposites] = useState<WizardComposite[]>(() => parseMalloyToComposites(initialCode));

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
        const file = files.find((f) => s.tableRef.endsWith(`${f.path}/${f.file_name}`));
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
      // input below always covers this case if the publisher can't list schemas.
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
    // `table` here is already the publisher's fully-qualified `resource`
    // (e.g. "public.orders") — no need to re-prefix with the schema.
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
      tableRef: `${PUBLISHER_VOLUME_ROOT}/${file.path}/${file.file_name}`,
    });
    setColumnOptions((prev) => ({ ...prev, [source.id]: [] }));
    try {
      const schema = await getFileSchema(fileId);
      setColumnOptions((prev) => ({ ...prev, [source.id]: schema.columns.map((c) => c.name) }));
    } catch {
      // Same fallback as the connection path — FieldPicker degrades to free text.
    }
  }

  function addAlias(source: WizardSource) {
    updateSource(source.id, { aliases: [...source.aliases, { id: uid(), name: "", field: "" }] });
  }
  function updateAlias(source: WizardSource, id: string, patch: Partial<WizardAlias>) {
    updateSource(source.id, { aliases: source.aliases.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }
  function removeAlias(source: WizardSource, id: string) {
    updateSource(source.id, { aliases: source.aliases.filter((a) => a.id !== id) });
  }

  function addDimension(source: WizardSource) {
    updateSource(source.id, { dimensions: [...source.dimensions, { id: uid(), name: "", expression: "" }] });
  }
  function updateDimension(source: WizardSource, id: string, patch: Partial<WizardDimension>) {
    updateSource(source.id, { dimensions: source.dimensions.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  }
  function removeDimension(source: WizardSource, id: string) {
    updateSource(source.id, { dimensions: source.dimensions.filter((d) => d.id !== id) });
  }

  function addMeasure(source: WizardSource) {
    updateSource(source.id, { measures: [...source.measures, { id: uid(), name: "", kind: "function", fn: "count", field: "", expression: "" }] });
  }
  function updateMeasure(source: WizardSource, id: string, patch: Partial<WizardMeasure>) {
    updateSource(source.id, { measures: source.measures.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  }
  function removeMeasure(source: WizardSource, id: string) {
    updateSource(source.id, { measures: source.measures.filter((m) => m.id !== id) });
  }

  function addJoin(source: WizardSource) {
    updateSource(source.id, { joins: [...source.joins, { id: uid(), kind: "join_one", targetSource: "", on: "" }] });
  }
  function updateJoin(source: WizardSource, id: string, patch: Partial<WizardJoin>) {
    updateSource(source.id, { joins: source.joins.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
  }
  function removeJoin(source: WizardSource, id: string) {
    updateSource(source.id, { joins: source.joins.filter((j) => j.id !== id) });
  }

  function addComposite() {
    setComposites((prev) => [...prev, newWizardComposite()]);
  }
  function updateComposite(id: string, patch: Partial<WizardComposite>) {
    setComposites((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeComposite(id: string) {
    setComposites((prev) => prev.filter((c) => c.id !== id));
  }
  function addCompositeMember(composite: WizardComposite) {
    updateComposite(composite.id, { members: [...composite.members, ""] });
  }
  function updateCompositeMember(composite: WizardComposite, index: number, value: string) {
    updateComposite(composite.id, { members: composite.members.map((m, i) => (i === index ? value : m)) });
  }
  function removeCompositeMember(composite: WizardComposite, index: number) {
    updateComposite(composite.id, { members: composite.members.filter((_, i) => i !== index) });
  }

  /** "Compose with joins" button: builds/updates a composite named after this
   * source, prioritizing the source itself first, then each distinct joined
   * source in the order its join was added. */
  function composeSourceWithJoins(source: WizardSource) {
    const joinedNames = Array.from(new Set(source.joins.map((j) => j.targetSource.trim()).filter(Boolean)));
    const members = [source.name.trim(), ...joinedNames].filter(Boolean);
    if (members.length < 2) return;

    const compositeName = `${source.name.trim()}_composite`;
    setComposites((prev) => {
      const existing = prev.find((c) => c.name.trim() === compositeName);
      if (existing) {
        return prev.map((c) => (c.id === existing.id ? { ...c, members } : c));
      }
      return [...prev, { id: uid(), name: compositeName, members }];
    });
  }

  const generated = [generateMalloy(sources), generateCompositeMalloy(composites)]
    .filter((block) => block.trim())
    .join("\n\n");

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
          onAddAlias={() => addAlias(source)}
          onUpdateAlias={(id, patch) => updateAlias(source, id, patch)}
          onRemoveAlias={(id) => removeAlias(source, id)}
          onAddDimension={() => addDimension(source)}
          onUpdateDimension={(id, patch) => updateDimension(source, id, patch)}
          onRemoveDimension={(id) => removeDimension(source, id)}
          onAddMeasure={() => addMeasure(source)}
          onUpdateMeasure={(id, patch) => updateMeasure(source, id, patch)}
          onRemoveMeasure={(id) => removeMeasure(source, id)}
          onAddJoin={() => addJoin(source)}
          onUpdateJoin={(id, patch) => updateJoin(source, id, patch)}
          onRemoveJoin={(id) => removeJoin(source, id)}
          onComposeWithJoins={() => composeSourceWithJoins(source)}
        />
      ))}
      <CButton variant="outline" onClick={addSource}>
        <FaPlus size={11} /> Add Source
      </CButton>

      {/* Composite sources — per Malloy's composite-sources experiment, wraps
          several sources so a query resolves against whichever one actually
          has the fields it selected, instead of merging rows via a join. */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold" style={{ color: "var(--text-h)" }}>Composite Sources</h3>
        {composites.map((composite) => (
          <CompositeCard
            key={composite.id}
            composite={composite}
            sourceNames={sources.map((s) => s.name.trim()).filter(Boolean)}
            onUpdate={(patch) => updateComposite(composite.id, patch)}
            onRemove={() => removeComposite(composite.id)}
            onAddMember={() => addCompositeMember(composite)}
            onUpdateMember={(idx, v) => updateCompositeMember(composite, idx, v)}
            onRemoveMember={(idx) => removeCompositeMember(composite, idx)}
          />
        ))}
        <CButton variant="outline" onClick={addComposite}>
          <FaPlus size={11} /> Add Composite Source
        </CButton>
      </div>
    </div>
  );
}
