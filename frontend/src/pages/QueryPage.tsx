import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaPlay, FaTable, FaLayerGroup, FaDatabase, FaTerminal, FaCode, FaSave, FaPlus
} from "react-icons/fa";
import { PiFileSqlFill } from "react-icons/pi";
import CFieldTree from "../components/CFieldTree";
import { TIME_GRANULARITIES, type Granularity, type SortItem } from "../lib/fieldTree";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";
import CSelect from "../components/CSelect";
import CTable from "../components/CTable";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CQueryBuilder, { EMPTY_FILTER_QUERY } from "../components/CQueryBuilder";
import { useTheme } from "../lib/theme";
import {
  listModels,
  getCompiledModel,
  getQuery,
  getQueries,
  createQuery,
  updateQuery,
  runQuery,
  type ModelPackage,
  type SemanticModelSchema,
  type QueryDetailedResponse,
  type QueryCreate,
} from "../lib/Api";
import {
  unwrapFilters,
  wrapFilters,
  buildGroupByFields,
  buildOrderByFields,
  partitionFilterQuery,
  mergeFilterQuery,
} from "../lib/querySerialize";
import { MalloyASTQueryBuilder } from "../lib/MalloyASTQueryBuilder";
import { normalizeQueryRows } from "../lib/queryResult";


import { FieldInfo, SourceInfo } from "@malloydata/malloy-interfaces";
import { type RuleGroupType } from "react-querybuilder";
import CToggleButtons from "../components/CToggleButtons";
import CButton from "../components/CButton";


// ── Constants ──────────────────────────────────────────────────────────────
type ResultView = "table" | "json"  | "malloy" | "sql";


const WINDOW_FUNCTIONS: Record<string, { fn: string; delta?: boolean }> = {
  Summation: { fn: "sum" },
  Average: { fn: "avg" },
  Max: { fn: "max" },
  Min: { fn: "min" },
  Count: { fn: "count" },
  Lead: { fn: "lead", delta: true },
  Lag: { fn: "lag", delta: true },
  First: { fn: "first_value" },
  Last: { fn: "last_value" },
};

function buildCalculatedColumnExpression(column: string, windowFn: string): string {
  const spec = WINDOW_FUNCTIONS[windowFn];
  if (!spec || !column) return "";
  const call = `${spec.fn}(${column})`;
  return spec.delta ? `${column} - ${call}` : call;
}

function buildCalculateBlock(name: string, expression: string, partitionBy: string[], orderBy: { field: string; dir: "asc" | "desc" }[]): string {
  const lines = [`calculate: ${name} is ${expression} {`];
  if (partitionBy.length) lines.push(`    partition_by: ${partitionBy.join(", ")}`);
  if (orderBy.length) lines.push(`    order_by: ${orderBy.map((o) => `${o.field} ${o.dir}`).join(", ")}`);
  lines.push(`  }`);
  return lines.join("\n");
}

interface CalculatedColumnDef {
  name: string;
  expression: string;
  partitionBy: string[];
  orderBy: { field: string; dir: "asc" | "desc" }[];
}

function toCalcFieldInfo(c: CalculatedColumnDef): FieldInfo {
  return { kind: "calculate", name: c.name, type: { kind: "number_type" } } as FieldInfo;
}

function CalculatedColumnModal({ open, onClose, onAdd, activeSchema, initial }: { open: boolean, onClose: () => void, onAdd: (def: CalculatedColumnDef, originalName?: string) => void, activeSchema: SourceInfo | null, initial?: CalculatedColumnDef | null }) {
  const [columnName, setColumnName] = useState("");
  const [orderBy, setOrderBy] = useState<{ field: string; dir: "asc" | "desc" }[]>([]);
  const [partitionBy, setPartitionBy] = useState<string[]>([]);
  const [windowFn, setWindowFn] = useState("Lag");
  const [error, setError] = useState("");
  const [expression, setExpression] = useState("");

  const fields = activeSchema?.schema?.fields ?? [];
  const isEditing = !!initial;

  useEffect(() => {
    if (!open) return;
    setColumnName(initial?.name ?? "");
    setExpression(initial?.expression ?? "");
    setOrderBy(initial?.orderBy ?? []);
    setPartitionBy(initial?.partitionBy ?? []);
    setWindowFn("Lag");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;

  const preview = columnName && expression
    ? buildCalculateBlock(columnName, expression, partitionBy, orderBy)
    : "";

  function handleAdd() {
    if (!columnName.trim() || !expression) {
      setError("Column name and column are required.");
      return;
    }
    onAdd({ name: columnName.trim(), expression: expression.trim(), partitionBy, orderBy }, initial?.name);
    onClose();
  }

  function addOrderByField(fieldName: string) {
    if (!fieldName || orderBy.some((o) => o.field === fieldName)) return;
    setOrderBy((prev) => [...prev, { field: fieldName, dir: "asc" }]);
  }

  function toggleOrderByDir(fieldName: string) {
    setOrderBy((prev) => prev.map((o) => (o.field === fieldName ? { ...o, dir: o.dir === "asc" ? "desc" : "asc" } : o)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.22)" }}>
      <div className="bg-white dark:bg-[#15121b] rounded-lg shadow-lg p-6 min-w-[320px] w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{isEditing ? "Edit" : "Add"} Calculated Column</h2>
          <button className="text-lg font-bold p-1 hover:bg-[var(--bg-subtle)] rounded" onClick={onClose} title="Close">&times;</button>
        </div>
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-h)" }}>Column Name</label>
          <input
            type="text"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs mb-3 outline-none"
            placeholder="e.g. year_change"
            style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-h)" }}>Expression</label>
          <textarea
            rows={4}
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs mb-3 outline-none"
            style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
          >
            {expression}
          </textarea>
        </div>
                <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-h)" }}>Partition By</label>
          {partitionBy.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {partitionBy.map((f) => (
                <span key={f} className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px]"
                  style={{ background: "var(--bg-subtle)", color: "var(--text-h)", border: "1px solid var(--border)" }}
                >
                  {f}
                  <button type="button" className="cursor-pointer font-bold leading-none"
                    onClick={() => setPartitionBy((prev) => prev.filter((x) => x !== f))}
                  >&times;</button>
                </span>
              ))}
            </div>
          )}
          <select
            value=""
            onChange={(e) => { const v = e.target.value; if (v) setPartitionBy((prev) => prev.includes(v) ? prev : [...prev, v]); }}
            className="w-full rounded border px-2 py-1 text-xs mb-3 outline-none"
            style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
          >
            <option value="">Add field…</option>
            {fields.filter((field) => !partitionBy.includes(field.name)).map((field) => (
              <option key={field.name} value={field.name}>{field.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-h)" }}>Order By</label>
          {orderBy.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              {orderBy.map((o) => (
                <div key={o.field} className="flex items-center gap-2 rounded px-2 py-1 text-[11px]"
                  style={{ background: "var(--bg-subtle)", color: "var(--text-h)", border: "1px solid var(--border)" }}
                >
                  <span className="flex-1">{o.field}</span>
                  <button type="button" className="cursor-pointer font-semibold uppercase"
                    onClick={() => toggleOrderByDir(o.field)}
                  >{o.dir}</button>
                  <button type="button" className="cursor-pointer font-bold leading-none"
                    onClick={() => setOrderBy((prev) => prev.filter((x) => x.field !== o.field))}
                  >&times;</button>
                </div>
              ))}
            </div>
          )}
          <select
            value=""
            onChange={(e) => addOrderByField(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs mb-3 outline-none"
            style={{ background: "var(--bg)", color: "var(--text)", borderColor: "var(--border)" }}
          >
            <option value="">Add field…</option>
            {fields.filter((field) => !orderBy.some((o) => o.field === field.name)).map((field) => (
              <option key={field.name} value={field.name}>{field.name}</option>
            ))}
          </select>
        </div>

        {preview && (
          <pre className="rounded border px-2 py-1.5 text-[11px] font-mono mb-3 overflow-auto"
            style={{ background: "var(--bg-subtle)", color: "var(--text-h)", borderColor: "var(--border)" }}
          >
            {preview}
          </pre>
        )}

        {error && <p className="text-xs mb-3" style={{ color: "#dc2626" }}>{error}</p>}

        <button
          className="mt-2 flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all cursor-pointer"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          onClick={handleAdd}
        >
          <span>{isEditing ? "Save" : "Add"}</span>
        </button>
      </div>
    </div>
  );
}


// ── Helpers ────────────────────────────────────────────────────────────────

function extractRows(result: unknown): Record<string, unknown>[] {
  return normalizeQueryRows(result);
}

function extractColumns(rows: Record<string, unknown>[]): string[] {
  return rows.length > 0 ? Object.keys(rows[0]) : [];
}

interface PendingHydration {
  source: string;
  groupBy: string[];
  agg: string[];
  filters: unknown;
  havings: unknown;
  calculatedColumns: CalculatedColumnDef[] | null;
  orderBy: Record<string, string> | null;
  malloyQuery: string;
}

interface PendingModelSelection {
  packageId: string;
  packageName: string;
  modelId: string;
  modelName: string;
}

function resolveModelSelection(
  packages: ModelPackage[],
  pending: PendingModelSelection,
): { packageId: string; modelId: string } | null {
  const pkg =
    packages.find((p) => p.id === pending.packageId) ??
    packages.find((p) => p.name === pending.packageName);
  if (!pkg) return null;

  const model =
    pkg.models.find((m) => m.id === pending.modelId) ??
    pkg.models.find((m) => m.name === pending.modelName);
  if (!model) return null;

  return { packageId: pkg.id, modelId: model.id };
}

function parseGroupByEntry(entry: string): { name: string; granularity?: Granularity } {
  const dot = entry.lastIndexOf(".");
  if (dot === -1) return { name: entry };
  const base = entry.slice(0, dot);
  const gran = entry.slice(dot + 1);
  if ((TIME_GRANULARITIES as readonly string[]).includes(gran)) {
    return { name: base, granularity: gran as Granularity };
  }
  return { name: entry };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function QueryPage() {
  const { queryId } = useParams<{ queryId?: string }>();
  const navigate = useNavigate();
  const isEditMode = !!queryId;
  const suppressCodegen = useRef(isEditMode);
  const prevPkgIdRef = useRef("");
  const [pendingModelSelection, setPendingModelSelection] = useState<PendingModelSelection | null>(null);
  const [awaitingModelSelection, setAwaitingModelSelection] = useState(isEditMode);
  const { theme } = useTheme();

  // Saved query (edit mode)
  const [loadingQuery, setLoadingQuery] = useState(isEditMode);
  const [queryLoadError, setQueryLoadError] = useState("");
  const [pendingHydration, setPendingHydration] = useState<PendingHydration | null>(null);

  // Model selection
  const [modelPackages, setModelPackages] = useState<ModelPackage[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [selectedPkgId, setSelectedPkgId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");

  // Schema
  const [compiledModel, setCompiledModel] = useState<SemanticModelSchema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState("");
  const [activeSchema, setActiveSchema] = useState<SourceInfo | null>(null);
  const [activeSource, setActiveSource] = useState<Array<SourceInfo> | null>(null);

  // Field selections
  const [groupByFields, setGroupByFields] = useState<FieldInfo[]>([]);
  const [aggFields, setAggFields] = useState<FieldInfo[]>([]);
  const [granularityMap, setGranularityMap] = useState<Record<string, Granularity>>({});
  const [sortMap, setSortMap] = useState<SortItem[]>([]);
  const [limit, setLimit] = useState(1000);

  const [query, setQuery] = useState<string | null>(null);
  const [queryName, setQueryName] = useState<string | null>(null);
  const [queryNameEditing, setQueryNameEditing] = useState(false);

  // Filters (react-querybuilder)
  const [filterQuery, setFilterQuery] = useState<RuleGroupType>(EMPTY_FILTER_QUERY);


  const [calculatedColumnModalOpen, setCalculatedColumnModalOpen] = useState(false);
  const [editingCalculatedColumn, setEditingCalculatedColumn] = useState<CalculatedColumnDef | null>(null);
  const [calculatedColumns, setCalculatedColumns] = useState<CalculatedColumnDef[]>([]);
  const [calcFields, setCalcFields] = useState<FieldInfo[]>([]);

  // Results
  const [running, setRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState("");
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const [resultView, setResultView] = useState<ResultView>("table");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  function applyPendingModelSelection(
    packages: ModelPackage[],
    pending: PendingModelSelection,
  ) {
    const resolved = resolveModelSelection(packages, pending);
    if (!resolved) return false;

    setSelectedPkgId(resolved.packageId);
    setSelectedModelId(resolved.modelId);
    return true;
  }

  // ── Load saved query (edit mode) ─────────────────────────────────────────
  useEffect(() => {
    if (!queryId) return;

    setLoadingQuery(true);
    setQueryLoadError("");
    suppressCodegen.current = true;

    getQuery(queryId)
      .then((saved: QueryDetailedResponse) => {
        setQueryName(saved.name);
        setLimit(saved.limit ?? 1000);
        setQuery(saved.malloy_query);
        setPendingModelSelection({
          packageId: saved.semantic_model.package.id,
          packageName: saved.semantic_model.package.name,
          modelId: saved.semantic_model.id,
          modelName: saved.semantic_model.name,
        });
        setAwaitingModelSelection(true);
        setPendingHydration({
          source: saved.source,
          groupBy: saved.group_by_fields ?? [],
          agg: saved.aggregation_fields ?? [],
          filters: saved.filters,
          havings: saved.havings,
          calculatedColumns: (saved.calculated_fields as CalculatedColumnDef[] | undefined) ?? null,
          orderBy: saved.order_by_fields,
          malloyQuery: saved.malloy_query,
        });
      })
      .catch((e: any) => setQueryLoadError(e.message ?? "Failed to load query."))
      .finally(() => setLoadingQuery(false));
  }, [queryId]);

  useEffect(() => {
    if (!pendingModelSelection || modelPackages.length === 0) return;

    if (applyPendingModelSelection(modelPackages, pendingModelSelection)) {
      setPendingModelSelection(null);
      setAwaitingModelSelection(false);
      return;
    }

    setQueryLoadError("Saved package or model could not be found.");
    setPendingModelSelection(null);
    setAwaitingModelSelection(false);
  }, [modelPackages, pendingModelSelection]);

  // ── Load models ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingModels(true);
    listModels()
      .then((pkgs) => {
        setModelPackages(pkgs);
      })
      .catch((e: any) => setModelsError(e.message ?? "Failed to load models."))
      .finally(() => setLoadingModels(false));
  }, []);

  const selectedPkg = modelPackages.find((p) => p.id === selectedPkgId);
  const pkgOptions = modelPackages.map((p) => ({ label: p.name, value: p.id }));
  const modelOptions = (selectedPkg?.models ?? []).map((m) => ({ label: m.name, value: m.id }));

  useEffect(() => {
    const prev = prevPkgIdRef.current;
    prevPkgIdRef.current = selectedPkgId;
    if (prev && prev !== selectedPkgId) {
      setSelectedModelId("");
    }
  }, [selectedPkgId]);

  // ── Load schema ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedModelId) return;
    setCompiledModel(null); setSchemaError(""); setActiveSource(null);
    setGroupByFields([]); setAggFields([]); setGranularityMap({}); setSortMap([]); setFilterQuery(EMPTY_FILTER_QUERY);
    setCalculatedColumns([]); setCalcFields([]);
    setQueryResult(null); setQueryError("");
    setLoadingSchema(true);
    getCompiledModel(selectedModelId)
      .then((s) => { setCompiledModel(s); if (s.sources.length > 0) setActiveSource(s.sources); })
      .catch((e: any) => setSchemaError(e.message ?? "Failed to load schema."))
      .finally(() => setLoadingSchema(false));
  }, [selectedModelId]);


  useEffect(() => {
    if (!activeSource) return;
    setActiveSchema(activeSource[0]);
  }, [activeSource]);

  // ── Hydrate UI from saved query after schema loads ───────────────────────
  useEffect(() => {
    if (!pendingHydration || !activeSource?.length) return;

    const source =
      activeSource.find((s) => s.name === pendingHydration.source) ?? activeSource[0];
    setActiveSchema(source);

    const fields = source.schema?.fields ?? [];
    const findField = (name: string) => fields.find((f) => f.name === name);

    const nextGroupBy: FieldInfo[] = [];
    const nextGranularity: Record<string, Granularity> = {};

    for (const entry of pendingHydration.groupBy) {
      const parsed = parseGroupByEntry(entry);
      const field = findField(parsed.name);
      if (!field) continue;
      nextGroupBy.push(field);
      if (parsed.granularity) nextGranularity[field.name] = parsed.granularity;
    }

    const nextAgg = pendingHydration.agg
      .map((name) => findField(name))
      .filter((f): f is FieldInfo => !!f);

    const nextSort: SortItem[] = [];
    if (pendingHydration.orderBy) {
      for (const [fieldName, dir] of Object.entries(pendingHydration.orderBy)) {
        const field = findField(fieldName);
        if (!field) continue;
        nextSort.push({ field, dir: dir === "desc" ? "desc" : "asc" });
      }
    }

    setGroupByFields(nextGroupBy);
    setAggFields(nextAgg);
    setGranularityMap(nextGranularity);
    setSortMap(nextSort);

    const unwrappedFilters = unwrapFilters(pendingHydration.filters);
    const unwrappedHavings = unwrapFilters(pendingHydration.havings);
    if (unwrappedFilters || unwrappedHavings) {
      setFilterQuery(mergeFilterQuery(unwrappedFilters, unwrappedHavings));
    }

    if (pendingHydration.calculatedColumns?.length) {
      setCalculatedColumns(pendingHydration.calculatedColumns);
      setCalcFields(pendingHydration.calculatedColumns.map(toCalcFieldInfo));
    }

    setQuery(pendingHydration.malloyQuery);
    setPendingHydration(null);
    suppressCodegen.current = false;
  }, [pendingHydration, activeSource]);

  useEffect(() => {
    if (!pendingHydration || loadingSchema) return;
    if (schemaError || (selectedModelId && !activeSource?.length)) {
      setPendingHydration(null);
      suppressCodegen.current = false;
    }
  }, [pendingHydration, loadingSchema, schemaError, selectedModelId, activeSource]);


  const calculatedFieldInfos = useMemo<FieldInfo[]>(
    () => calculatedColumns.map(toCalcFieldInfo),
    [calculatedColumns],
  );
  const calcColumnsByName = useMemo(
    () => new Map(calculatedColumns.map((c) => [c.name, c])),
    [calculatedColumns],
  );

  const generatedQuery = useMemo(() => {
    if (!activeSchema) return null;
  
    try {
      const builder = new MalloyASTQueryBuilder(activeSchema);
  
      // 1. Map over active Dimensions & Time Granularities
      if (groupByFields.length > 0) {
        for (const field of groupByFields) {
          builder.addGroupBy(field.name, granularityMap[field.name]);
        }
      }
      // 2. Add Aggregate Fields Measures
      if (aggFields.length > 0) {
        for (const field of aggFields) {
          
          builder.addAgg(field );
        }
      }
  
      // 2b. Add Selected Calculated (window function) Columns
      if (calcFields.length > 0) {
        for (const field of calcFields) {
          const def = calcColumnsByName.get(field.name);
          if (def) builder.addCalculate(def.name, def.expression, def.partitionBy, def.orderBy);
        }
      }

      // 3. Set Execution Record Maximum Window Limit
      if (limit > 0) {
        builder.setLimit(limit);
      }
  
      // 4. FIXED: String-Based Field Verification Loop for Order Modifiers
      if (sortMap.length > 0) {
        // Create a flat array of active group-by string names for proper lookups
        const activeGroupNames = groupByFields.map((f: any) => f.name);
  
        for (const sortItem of sortMap) {
          // Safe string-to-string comparative lookup mapping
          if (!activeGroupNames.includes(sortItem.field.name)) {
            continue; // Skip invalid sorting columns cleanly without breaking the whole hook
          }
          builder.addSort(sortItem.field, sortItem.dir === "asc" ? "asc" : "desc");
        }
      }
  
      // 5. Build and Apply Tree-Aware Filters — measure-kind rules become `having`, the rest stay `where`
      if (filterQuery && filterQuery.rules && filterQuery.rules.length > 0) {
        const { where, having } = partitionFilterQuery(filterQuery, activeSchema.schema?.fields ?? []);
        if (where) builder.addFilter(where);
        if (having) builder.addHaving(having);
      }
  
      // Return the completed object directly from the memo calculation tree

      return builder.buildQuery();
  
    } catch (e: any) {
      console.error("Failed compiling Malloy AST target syntax query structures:", e);
      return null;
    }
  }, [groupByFields, aggFields, calcFields, calcColumnsByName, limit, sortMap, filterQuery, granularityMap, activeSchema]);
  
  // 6. SAFE STATE SYNCHRONIZATION FLOW
  // Automatically pipes the pure calculation results straight to your engine's state manager 
  useEffect(() => {
    if (generatedQuery && !suppressCodegen.current) {
      setQuery(generatedQuery);
    }
  }, [generatedQuery]);
    // ── Toggle field ─────────────────────────────────────────────────────────
  function toggleField(field: FieldInfo) {

    const kind = field.kind.toLowerCase();
    if (kind === "measure") {
      setAggFields((prev) => prev.some((f) => f.name === field.name) ? prev.filter((f) => f.name !== field.name) : [...prev, field]);
    } else if (kind === "calculate") {
      setCalcFields((prev) => prev.some((f) => f.name === field.name) ? prev.filter((f) => f.name !== field.name) : [...prev, field]);
    } else {
      setGroupByFields((prev) => {
        const next = prev.some((f) => f.name === field.name) ? prev.filter((f) => f.name !== field.name) : [...prev, field];
        // clear granularity if deselected
        if (prev.some((f) => f.name === field.name)) setGranularityMap((g) => { const c = { ...g }; delete c[field.name]; return c; });
        return next;
      });
    }
    // clear sort if deselected
    setSortMap((prev) => {
      const isSelected = kind === "measure" ? aggFields.some((f) => f.name === field.name) : kind === "calculate" ? calcFields.some((f) => f.name === field.name) : groupByFields.some((f) => f.name === field.name);
      if (isSelected) { return prev.filter((s) => s.field.name !== field.name); }
      return prev;
    });
  }

  // ── Remove calculated column ─────────────────────────────────────────────
  function handleRemoveCalculatedColumn(name: string) {
    setCalculatedColumns((prev) => prev.filter((c) => c.name !== name));
    setCalcFields((prev) => prev.filter((f) => f.name !== name));
    setSortMap((prev) => prev.filter((s) => s.field.name !== name));
  }

  // ── Toggle sort ───────────────────────────────────────────────────────────
  function cycleSort(e: React.MouseEvent<HTMLDivElement>, field: FieldInfo) {
    // CRITICAL: Stops the click from bubbling up to parent rows/buttons
    e.preventDefault();
    e.stopPropagation();

    setSortMap((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const existing = current.find((s) => s.field.name === field.name);

      // State 1: Not sorted yet -> Set to ASC
      if (!existing) {
        return [...current, { field, dir: "asc" }];
      }

      // State 2: Current is ASC -> Update to DESC
      if (existing.dir === "asc") {
        return current.map((s) =>
          s.field.name === field.name ? { ...s, dir: "desc" as const } : s
        );
      }


      // State 3: Current is DESC -> Remove completely
      return current.filter((s) => s.field.name !== field.name);
    });
  }

  // ── Set granularity ───────────────────────────────────────────────────────
  function setGranularity(e: React.MouseEvent, fieldName: string, gran: Granularity) {
    e.stopPropagation();
    setGranularityMap((prev) => ({ ...prev, [fieldName]: gran }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function buildSavePayload(): QueryCreate | null {
    const name = queryName?.trim();
    if (!name || !selectedModelId || !activeSchema || !query) return null;

    const groupBy = buildGroupByFields(groupByFields, granularityMap);
    const orderBy = buildOrderByFields(sortMap);
    const { where, having } = partitionFilterQuery(filterQuery, activeSchema.schema?.fields ?? []);
    const filters = where ? wrapFilters(where) : undefined;
    const havings = having ? wrapFilters(having) : undefined;

    return {
      name,
      source: activeSchema.name,
      aggregation_fields: aggFields.map((field) => field.name),
      ...(groupBy.length ? { group_by_fields: groupBy } : {}),
      ...(filters ? { filters } : {}),
      ...(havings ? { havings } : {}),
      ...(calculatedColumns.length ? { calculated_fields: calculatedColumns } : {}),
      ...(orderBy ? { order_by_fields: orderBy } : {}),
      limit,
      malloy_query: query,
    };
  }

  async function handleSave() {
    const payload = buildSavePayload();
    if (!payload) {
      setSaveError("Enter a query name and build a query before saving.");
      setSaveSuccess("");
      return;
    }
    if (!selectedModelId) {
      setSaveError("Select a semantic model before saving.");
      setSaveSuccess("");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      if (isEditMode && queryId) {
        await updateQuery(queryId, {
          ...payload,
          semantic_model_id: selectedModelId,
        });
        setSaveSuccess("Query updated.");
      } else {
        await createQuery(selectedModelId, payload);
        const created = (await getQueries()).find((q) => q.name === payload.name);
        setSaveSuccess("Query created.");
        if (created) {
          navigate(`/queries/${created.id}/edit`, { replace: true });
        }
      }
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Calculated column ────────────────────────────────────────────────────
  function handleAddCalculatedColumn(def: CalculatedColumnDef, originalName?: string) {
    setCalculatedColumns((prev) => [...prev.filter((c) => c.name !== def.name && c.name !== originalName), def]);
    if (originalName && originalName !== def.name) {
      setCalcFields((prev) => prev.map((f) => f.name === originalName ? { ...f, name: def.name } : f));
      setSortMap((prev) => prev.map((s) => s.field.name === originalName ? { ...s, field: { ...s.field, name: def.name } } : s));
    }
  }

  function handleEditCalculatedColumn(name: string) {
    const def = calculatedColumns.find((c) => c.name === name);
    if (!def) return;
    setEditingCalculatedColumn(def);
    setCalculatedColumnModalOpen(true);
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  async function handleRun() {
    if (!selectedModelId || !activeSchema) return;

    setRunning(true);
    setQueryError("");
    setQueryResult(null);
    setQueryTime(null);

    
      let result;
      try {
        result = await runQuery(selectedModelId, generatedQuery ?? "");
      } catch (err: any) {
        setRunning(false);
        setQueryError(err?.message ?? "Query execution failed.");
        setQueryResult(null);
        setQueryTime(null);
        return;
      }

    try {

      setQueryTime(result?.time ?? null);
      setQueryResult(result);
      setResultView("table");
      setRunning(false);
    } catch (e: any) {
      setRunning(false);
      setQueryError(e?.message ?? "Query failed.");
      setQueryResult(null);
      setQueryTime(null);
    }
  }

  const resultRows = useMemo(() => extractRows(queryResult), [queryResult]);
  const resultColumns = useMemo(() => extractColumns(resultRows), [resultRows]);

  const lightTheme = EditorView.theme({
    "&": { background: "var(--bg)", color: "var(--text-h)" },
    ".cm-gutters": { background: "var(--bg-subtle)", borderRight: "1px solid var(--border)", color: "var(--text)" },
    ".cm-activeLine": { background: "var(--accent-muted)" },
    ".cm-cursor": { borderLeftColor: "var(--accent)" },
    ".cm-scroller": { fontFamily: "ui-monospace, Consolas, monospace" },
  });
  const editorTheme = theme === "dark" ? vscodeDark : lightTheme;

  const pageBusy =
    loadingModels ||
    loadingQuery ||
    !!pendingHydration ||
    awaitingModelSelection;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden" style={{ background: "var(--bg)" }}>

      {queryLoadError && (
        <div className="px-4 py-2">
          <CAlert variant="error" message={queryLoadError} />
        </div>
      )}

      {saveError && (
        <div className="px-4 py-2">
          <CAlert variant="error" message={saveError} />
        </div>
      )}

      {saveSuccess && (
        <div className="px-4 py-2">
          <CAlert variant="success" message={saveSuccess} />
        </div>
      )}

      {pageBusy ? (
        <div className="flex flex-1 items-center justify-center">
          <CSpinner size={32} />
        </div>
      ) : (
        <>

      {/* Top bar */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}
      >
        <PiFileSqlFill size={18} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-bold" style={{ color: "var(--text-h)" }}>
          {isEditMode ? "Edit Query" : "Query Builder"}
        </span>
        {queryNameEditing ? (
          <input
            type="text"
            value={queryName ?? "New Query"}
            autoFocus
            onChange={(e) => setQueryName(e.target.value)}
            onBlur={() => setQueryNameEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQueryNameEditing(false);
              if (e.key === 'Escape') {setQueryNameEditing(false)};
            }}
            className="w-48 rounded-lg border px-2 py-1 text-left text-xs font-semibold outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            style={{ background: "var(--bg)", color: "var(--text-h)", borderColor: "var(--border)" }}
          />
        ) : (
          <span
            className="text-xs cursor-pointer"
            style={{ color: "var(--text)" }}
            onClick={() => setQueryNameEditing(true)}
            tabIndex={0}
            onBlur={() => setQueryNameEditing(false)}
          >
            {queryName ?? "New Query"}
          </span>
        )}
  
        <div className="flex-1" />

        <CToggleButtons buttons={[
          {label: "Table", value: "table", icon: FaTable},
          {label: "JSON", value: "json", icon: FaCode},
          {label: "Malloy", value: "malloy", icon: FaDatabase , disabled: query === null},
          {label: "SQL", value: "sql", icon: FaTerminal , disabled: query === null},
        ]} selected={resultView} onChange={(value) => setResultView(value as ResultView)} />

        {queryTime !== null && (
          <span className="text-xs" style={{ color: "var(--text)" }}>{queryTime.toFixed(3)}s</span>
        )}

        <button onClick={handleRun}
          disabled={!query || running}
          className="flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {running ? <CSpinner size={12} /> : <FaPlay size={11} />} Run
        </button>
        <CButton
          variant="primary"
          onClick={handleSave}
          loading={saving}
          disabled={!query || running}
          className="!px-4 !py-1.5 !text-xs"
        >
          <FaSave size={11} /> Save
        </CButton>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ────────────────────────────────────────────── */}
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto"
          style={{ borderRight: "1px solid var(--border)", background: "var(--bg-subtle)" }}
        >
          {/* Selectors */}
          <div className="flex flex-col gap-3 p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            {modelsError && <CAlert variant="error" message={modelsError} />}
            {loadingModels
              ? <div className="flex justify-center py-4"><CSpinner size={18} /></div>
              : <>
                <CSelect label="Package" value={selectedPkgId} onChange={setSelectedPkgId} options={pkgOptions} placeholder="Select package…" />
                <CSelect label="Model" value={selectedModelId} onChange={setSelectedModelId} options={modelOptions} placeholder="Select model…" />
              </>
            }
          </div>

          {/* Limit */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Limit</span>
            <input type="number" value={limit} onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))} min={1}
              className="w-24 rounded-lg border px-2 py-1 text-right text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
              style={{ background: "var(--bg)", color: "var(--text-h)", borderColor: "var(--border)" }}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Calculated Column</span>
            <button className="flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              onClick={() => { setEditingCalculatedColumn(null); setCalculatedColumnModalOpen(true); }}
            >
              <FaPlus size={11} />
            </button>
          </div>


          {/* Schema browser */}
          <div className="flex-1 overflow-y-auto py-1">
            {schemaError && <div className="p-3"><CAlert variant="error" message={schemaError} /></div>}
            {loadingSchema && <div className="flex justify-center py-8"><CSpinner size={20} /></div>}

            {activeSource?.map((schema: SourceInfo) => {
              const srcActive = activeSchema?.name === schema.name;
              return (
                <div key={schema.name}>
                  {/* Source row */}
                  <button type="button" onClick={() => { setActiveSchema(schema); setGroupByFields([]); setAggFields([]); setGranularityMap({}); setSortMap([]); setFilterQuery(EMPTY_FILTER_QUERY); setCalculatedColumns([]); setCalcFields([]); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                    style={srcActive ? { background: "var(--accent-muted)", color: "var(--accent)" } : { color: "var(--text-h)" }}
                  >
                    <FaLayerGroup size={12} style={{ color: srcActive ? "var(--accent)" : "var(--text)" }} />
                    <span className="text-xs font-semibold">{schema.name}</span>
                    <span className="ml-auto text-[10px]" style={{ color: "var(--text)" }}>{schema.schema?.fields.length}</span>
                  </button>

                  {/* Field tree */}
                  {srcActive && (
                    <CFieldTree
                      fields={[...schema.schema.fields, ...calculatedFieldInfos]}
                      groupByFields={groupByFields}
                      aggFields={[...aggFields, ...calcFields]}
                      granularityMap={granularityMap}
                      sortMap={sortMap}
                      onToggleField={toggleField}
                      onSetGranularity={setGranularity}
                      onCycleSort={cycleSort}
                      onRemoveCalculated={handleRemoveCalculatedColumn}
                      onEditCalculated={handleEditCalculatedColumn}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Right main area ─────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">

          <CQueryBuilder
            fields={activeSchema?.schema?.fields}
            query={filterQuery}
            onQueryChange={setFilterQuery}
          />

          {/* Results */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-3 px-3 py-1.5"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}
            >
              <FaTable size={11} style={{ color: "var(--accent)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Results</span>
              {resultRows.length > 0 && (
                <span className="text-xs" style={{ color: "var(--text)" }}>
                  {resultRows.length} row{resultRows.length !== 1 ? "s" : ""}
                  {queryTime !== null && ` · ${queryTime.toFixed(3)}s`}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {queryError && <div className="p-4"><CAlert variant="error" message={queryError} /></div>}

              {!queryError && !queryResult && !running && (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
                  <FaPlay size={28} style={{ color: "var(--border)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--text-h)" }}>Select fields and run your query</p>
                  <p className="text-xs" style={{ color: "var(--text)" }}>Choose a source from the sidebar, pick fields, then click Run.</p>
                </div>
              )}

              {running && <div className="flex items-center justify-center py-20"><CSpinner size={28} /></div>}

              {!running && queryResult && (
                <>
                  {resultView === "table" && <CTable columns={resultColumns} rows={resultRows} maxHeight="100%" />}
                  {resultView === "json" && (
                    <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto"
                      style={{ color: "var(--text-h)", background: "var(--bg)" }}
                    >
                      {JSON.stringify(queryResult, null, 2)}
                    </pre>
                  )}
                  {resultView === "malloy" && (
                    <div className="flex flex-col gap-2">
                    <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto"
                      style={{ color: "var(--text-h)", background: "var(--bg)" }}
                    >
                      {query}
                    </pre>
                    </div>
                    )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
        </>
      )}

      <CalculatedColumnModal
        open={calculatedColumnModalOpen}
        onClose={() => { setCalculatedColumnModalOpen(false); setEditingCalculatedColumn(null); }}
        onAdd={handleAddCalculatedColumn}
        activeSchema={activeSchema}
        initial={editingCalculatedColumn}
      />
    </div>
  );
}
