import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaPlay, FaTable, FaLayerGroup, FaDatabase, FaTerminal, FaCode, FaSave
} from "react-icons/fa";
import { PiFileSqlFill } from "react-icons/pi";
import { MdRefresh } from "react-icons/md";
import CFieldTree from "../components/CFieldTree";
import { TIME_GRANULARITIES, type Granularity, type SortItem } from "../lib/fieldTree";
import CSelect from "../components/CSelect";
import CTable from "../components/CTable";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CQueryBuilder, { EMPTY_FILTER_QUERY } from "../components/CQueryBuilder";
import {
  listModelsWithDefinitions,
  getCompiledDefinition,
  getDataset,
  getDatasets,
  createDataset,
  updateDataset,
  runQuery,
  type Model,
  type DefinitionSchema,
  type DatasetDetailedResponse,
  type DatasetCreate,
} from "../lib/Api";
import {
  unwrapFilters,
  wrapFilters,
  buildGroupByFields,
  buildOrderByFields,
  partitionFilterQuery,
  mergeFilterQuery,
} from "../lib/querySerialize";
import { CubeQueryBuilder } from "../lib/CubeQueryBuilder";
import { normalizeQueryRows } from "../lib/queryResult";

import { FieldInfo, SourceInfo, CubeQuery } from "../lib/cubeTypes";
import { type RuleGroupType } from "react-querybuilder";
import CToggleButtons from "../components/CToggleButtons";
import CButton from "../components/CButton";


// ── Constants ──────────────────────────────────────────────────────────────
type ResultView = "table" | "json" | "cube" | "sql";

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
  orderBy: Record<string, string> | null;
  cubeQuery: CubeQuery;
}

interface PendingModelSelection {
  modelId: string;
  modelName: string;
  definitionId: string;
  definitionName: string;
}

function resolveModelSelection(
  models: Model[],
  pending: PendingModelSelection,
): { modelId: string; definitionId: string } | null {
  const model =
    models.find((m) => m.id === pending.modelId) ??
    models.find((m) => m.name === pending.modelName);
  if (!model) return null;

  const definition =
    model.definitions.find((d) => d.id === pending.definitionId) ??
    model.definitions.find((d) => d.name === pending.definitionName);
  if (!definition) return null;

  return { modelId: model.id, definitionId: definition.id };
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
export default function DatasetPage() {
  const { datasetId } = useParams<{ datasetId?: string }>();
  const navigate = useNavigate();
  const isEditMode = !!datasetId;
  const suppressCodegen = useRef(isEditMode);
  const prevModelIdRef = useRef("");
  const [pendingModelSelection, setPendingModelSelection] = useState<PendingModelSelection | null>(null);
  const [awaitingModelSelection, setAwaitingModelSelection] = useState(isEditMode);

  // Saved dataset (edit mode)
  const [loadingDataset, setLoadingDataset] = useState(isEditMode);
  const [datasetLoadError, setDatasetLoadError] = useState("");
  const [pendingHydration, setPendingHydration] = useState<PendingHydration | null>(null);

  // Model / definition selection
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedDefinitionId, setSelectedDefinitionId] = useState("");

  // Schema
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

  const [query, setQuery] = useState<CubeQuery | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [datasetNameEditing, setDatasetNameEditing] = useState(false);

  // Filters (react-querybuilder)
  const [filterQuery, setFilterQuery] = useState<RuleGroupType>(EMPTY_FILTER_QUERY);

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
    models: Model[],
    pending: PendingModelSelection,
  ) {
    const resolved = resolveModelSelection(models, pending);
    if (!resolved) return false;

    setSelectedModelId(resolved.modelId);
    setSelectedDefinitionId(resolved.definitionId);
    return true;
  }

  // ── Load saved dataset (edit mode) ───────────────────────────────────────
  useEffect(() => {
    if (!datasetId) return;

    setLoadingDataset(true);
    setDatasetLoadError("");
    suppressCodegen.current = true;

    getDataset(datasetId)
      .then((saved: DatasetDetailedResponse) => {
        setDatasetName(saved.name);
        setLimit(saved.limit ?? 1000);
        setQuery(saved.cube_query);
        setPendingModelSelection({
          modelId: saved.definition.model.id,
          modelName: saved.definition.model.name,
          definitionId: saved.definition.id,
          definitionName: saved.definition.name,
        });
        setAwaitingModelSelection(true);
        setPendingHydration({
          source: saved.source,
          groupBy: saved.group_by_fields ?? [],
          agg: saved.aggregation_fields ?? [],
          filters: saved.filters,
          havings: saved.havings,
          orderBy: saved.order_by_fields,
          cubeQuery: saved.cube_query,
        });
      })
      .catch((e: any) => setDatasetLoadError(e.message ?? "Failed to load dataset."))
      .finally(() => setLoadingDataset(false));
  }, [datasetId]);

  useEffect(() => {
    if (!pendingModelSelection || models.length === 0) return;

    if (applyPendingModelSelection(models, pendingModelSelection)) {
      setPendingModelSelection(null);
      setAwaitingModelSelection(false);
      return;
    }

    setDatasetLoadError("Saved model or definition could not be found.");
    setPendingModelSelection(null);
    setAwaitingModelSelection(false);
  }, [models, pendingModelSelection]);

  // ── Load models ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingModels(true);
    listModelsWithDefinitions()
      .then((mods) => {
        setModels(mods);
      })
      .catch((e: any) => setModelsError(e.message ?? "Failed to load models."))
      .finally(() => setLoadingModels(false));
  }, []);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const modelOptions = models.map((m) => ({ label: m.name, value: m.id }));
  const definitionOptions = (selectedModel?.definitions ?? []).map((d) => ({ label: d.name, value: d.id }));

  useEffect(() => {
    const prev = prevModelIdRef.current;
    prevModelIdRef.current = selectedModelId;
    if (prev && prev !== selectedModelId) {
      setSelectedDefinitionId("");
    }
  }, [selectedModelId]);

  // ── Load schema — also callable directly by the "Refresh Definition" button ────
  const loadSchema = useCallback(() => {
    if (!selectedDefinitionId) return;
    setSchemaError(""); setActiveSource(null);
    setGroupByFields([]); setAggFields([]); setGranularityMap({}); setSortMap([]); setFilterQuery(EMPTY_FILTER_QUERY);
    setQueryResult(null); setQueryError("");
    setLoadingSchema(true);
    getCompiledDefinition(selectedDefinitionId)
      .then((s: DefinitionSchema) => { if (s.sources.length > 0) setActiveSource(s.sources); })
      .catch((e: any) => setSchemaError(e.message ?? "Failed to load schema."))
      .finally(() => setLoadingSchema(false));
  }, [selectedDefinitionId]);

  useEffect(() => { loadSchema(); }, [loadSchema]);


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

    setQuery(pendingHydration.cubeQuery);
    setPendingHydration(null);
    suppressCodegen.current = false;
  }, [pendingHydration, activeSource]);

  useEffect(() => {
    if (!pendingHydration || loadingSchema) return;
    if (schemaError || (selectedDefinitionId && !activeSource?.length)) {
      setPendingHydration(null);
      suppressCodegen.current = false;
    }
  }, [pendingHydration, loadingSchema, schemaError, selectedDefinitionId, activeSource]);

  const hasSelection = groupByFields.length > 0 || aggFields.length > 0;

  const generatedQuery = useMemo(() => {
    if (!activeSchema) return null;

    try {
      const builder = new CubeQueryBuilder(activeSchema);

      for (const field of groupByFields) {
        builder.addGroupBy(field.name, granularityMap[field.name]);
      }
      for (const field of aggFields) {
        builder.addAgg(field);
      }
      if (limit > 0) {
        builder.setLimit(limit);
      }

      const activeGroupNames = groupByFields.map((f) => f.name);
      for (const sortItem of sortMap) {
        if (!activeGroupNames.includes(sortItem.field.name)) continue;
        builder.addSort(sortItem.field, sortItem.dir === "asc" ? "asc" : "desc");
      }

      if (filterQuery && filterQuery.rules && filterQuery.rules.length > 0) {
        const { where, having } = partitionFilterQuery(filterQuery, activeSchema.schema?.fields ?? []);
        if (where) builder.addFilter(where);
        if (having) builder.addHaving(having);
      }

      return builder.buildQuery();
    } catch (e: any) {
      console.error("Failed building Cube query:", e);
      return null;
    }
  }, [groupByFields, aggFields, limit, sortMap, filterQuery, granularityMap, activeSchema]);

  // Pipes the built query straight into the editable/persisted state, unless
  // a saved-query hydration is still in flight (that owns `query` until done).
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
      const isSelected = kind === "measure" ? aggFields.some((f) => f.name === field.name) : groupByFields.some((f) => f.name === field.name);
      if (isSelected) { return prev.filter((s) => s.field.name !== field.name); }
      return prev;
    });
  }

  // ── Toggle sort ───────────────────────────────────────────────────────────
  function cycleSort(e: React.MouseEvent<HTMLDivElement>, field: FieldInfo) {
    e.preventDefault();
    e.stopPropagation();

    setSortMap((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const existing = current.find((s) => s.field.name === field.name);

      if (!existing) {
        return [...current, { field, dir: "asc" }];
      }
      if (existing.dir === "asc") {
        return current.map((s) =>
          s.field.name === field.name ? { ...s, dir: "desc" as const } : s
        );
      }
      return current.filter((s) => s.field.name !== field.name);
    });
  }

  // ── Set granularity ───────────────────────────────────────────────────────
  function setGranularity(e: React.MouseEvent, fieldName: string, gran: Granularity) {
    e.stopPropagation();
    setGranularityMap((prev) => ({ ...prev, [fieldName]: gran }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function buildSavePayload(): DatasetCreate | null {
    const name = datasetName?.trim();
    if (!name || !selectedDefinitionId || !activeSchema || !query) return null;

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
      ...(orderBy ? { order_by_fields: orderBy } : {}),
      limit,
      cube_query: query,
    };
  }

  async function handleSave() {
    const payload = buildSavePayload();
    if (!payload) {
      setSaveError("Enter a dataset name and build a query before saving.");
      setSaveSuccess("");
      return;
    }
    if (!selectedDefinitionId) {
      setSaveError("Select a definition before saving.");
      setSaveSuccess("");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      if (isEditMode && datasetId) {
        await updateDataset(datasetId, {
          ...payload,
          definition_id: selectedDefinitionId,
        });
        setSaveSuccess("Dataset updated.");
      } else {
        await createDataset(selectedDefinitionId, payload);
        const created = (await getDatasets()).find((d) => d.name === payload.name);
        setSaveSuccess("Dataset created.");
        if (created) {
          navigate(`/datasets/${created.id}/edit`, { replace: true });
        }
      }
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  async function handleRun() {
    if (!selectedDefinitionId || !activeSchema) return;

    setRunning(true);
    setQueryError("");
    setQueryResult(null);
    setQueryTime(null);

    let result;
    try {
      result = await runQuery(selectedDefinitionId, generatedQuery ?? {});
    } catch (err: any) {
      setRunning(false);
      setQueryError(err?.message ?? "Query execution failed.");
      setQueryResult(null);
      setQueryTime(null);
      return;
    }

    setQueryTime(result?.time ?? null);
    setQueryResult(result);
    setResultView("table");
    setRunning(false);
  }

  const resultRows = useMemo(() => extractRows(queryResult), [queryResult]);
  const resultColumns = useMemo(() => extractColumns(resultRows), [resultRows]);

  const pageBusy =
    loadingModels ||
    loadingDataset ||
    !!pendingHydration ||
    awaitingModelSelection;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden" style={{ background: "var(--bg)" }}>

      {datasetLoadError && (
        <div className="px-4 py-2">
          <CAlert variant="error" message={datasetLoadError} />
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
          {isEditMode ? "Edit Dataset" : "Dataset Builder"}
        </span>
        {datasetNameEditing ? (
          <input
            type="text"
            value={datasetName ?? "New Dataset"}
            autoFocus
            onChange={(e) => setDatasetName(e.target.value)}
            onBlur={() => setDatasetNameEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setDatasetNameEditing(false);
              if (e.key === 'Escape') {setDatasetNameEditing(false)};
            }}
            className="w-48 rounded-lg border px-2 py-1 text-left text-xs font-semibold outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            style={{ background: "var(--bg)", color: "var(--text-h)", borderColor: "var(--border)" }}
          />
        ) : (
          <span
            className="text-xs cursor-pointer"
            style={{ color: "var(--text)" }}
            onClick={() => setDatasetNameEditing(true)}
            tabIndex={0}
            onBlur={() => setDatasetNameEditing(false)}
          >
            {datasetName ?? "New Dataset"}
          </span>
        )}

        <div className="flex-1" />

        <CToggleButtons buttons={[
          {label: "Table", value: "table", icon: FaTable},
          {label: "JSON", value: "json", icon: FaCode},
          {label: "Cube Query", value: "cube", icon: FaDatabase , disabled: query === null},
          {label: "SQL", value: "sql", icon: FaTerminal , disabled: query === null},
        ]} selected={resultView} onChange={(value) => setResultView(value as ResultView)} />

        {queryTime !== null && (
          <span className="text-xs" style={{ color: "var(--text)" }}>{queryTime.toFixed(3)}s</span>
        )}

        <button onClick={handleRun}
          disabled={!hasSelection || running}
          className="flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {running ? <CSpinner size={12} /> : <FaPlay size={11} />} Run
        </button>
        <CButton
          variant="primary"
          onClick={handleSave}
          loading={saving}
          disabled={!hasSelection || running}
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
                <CSelect label="Model" value={selectedModelId} onChange={setSelectedModelId} options={modelOptions} placeholder="Select model…" />
                <CSelect label="Definition" value={selectedDefinitionId} onChange={setSelectedDefinitionId} options={definitionOptions} placeholder="Select definition…" />
                <CButton
                  variant="outline"
                  fullWidth
                  loading={loadingSchema}
                  disabled={!selectedDefinitionId}
                  onClick={loadSchema}
                  className="!text-xs"
                >
                  <MdRefresh size={13} /> Refresh Definition
                </CButton>
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

          {/* Schema browser */}
          <div className="flex-1 overflow-y-auto py-1">
            {schemaError && <div className="p-3"><CAlert variant="error" message={schemaError} /></div>}
            {loadingSchema && <div className="flex justify-center py-8"><CSpinner size={20} /></div>}

            {activeSource?.map((schema: SourceInfo) => {
              const srcActive = activeSchema?.name === schema.name;
              return (
                <div key={schema.name}>
                  {/* Source row */}
                  <button type="button" onClick={() => { setActiveSchema(schema); setGroupByFields([]); setAggFields([]); setGranularityMap({}); setSortMap([]); setFilterQuery(EMPTY_FILTER_QUERY); }}
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
                      fields={schema.schema.fields}
                      groupByFields={groupByFields}
                      aggFields={aggFields}
                      granularityMap={granularityMap}
                      sortMap={sortMap}
                      onToggleField={toggleField}
                      onSetGranularity={setGranularity}
                      onCycleSort={cycleSort}
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
                  {resultView === "cube" && (
                    <div className="flex flex-col gap-2">
                    <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto"
                      style={{ color: "var(--text-h)", background: "var(--bg)" }}
                    >
                      {JSON.stringify(query, null, 2)}
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
    </div>
  );
}
