import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaPlay, FaTable, FaLayerGroup, FaDatabase, FaTerminal, FaCode, FaSave, FaThumbtack
} from "react-icons/fa";
import { PiFileSqlFill } from "react-icons/pi";
import { MdRefresh } from "react-icons/md";
import CFieldTree from "../components/CFieldTree";
import { TIME_GRANULARITIES, type Granularity, type SortItem } from "../lib/fieldTree";
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

/** A field tagged with the cube/source it came from — lets group-by fields
 * and measures be picked from more than one joined source at once. */
type MultiField = FieldInfo & { sourceName: string };

function sameField(a: MultiField, name: string, sourceName: string): boolean {
  return a.name === name && a.sourceName === sourceName;
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
  // Sources shown (and selectable from) alongside the active one — lets a
  // query mix fields from several joined cubes, not just the active one.
  const [pinnedSourceNames, setPinnedSourceNames] = useState<Set<string>>(new Set());

  // Field selections
  const [groupByFields, setGroupByFields] = useState<MultiField[]>([]);
  const [aggFields, setAggFields] = useState<MultiField[]>([]);
  // Keyed by "sourceName::fieldName" to avoid collisions between sources.
  const [granularityMap, setGranularityMap] = useState<Record<string, Granularity>>({});
  const [sortMap, setSortMap] = useState<(SortItem & { field: MultiField })[]>([]);
  // Always applied to the builder's own preview/Run query (query safety) —
  // dashboards separately decide whether to inherit it via limitOnDashboard.
  const [limit, setLimit] = useState(1000);
  const [limitOnDashboard, setLimitOnDashboard] = useState(true);

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
        setLimitOnDashboard(saved.limit_enabled ?? true);
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
    setSchemaError(""); setActiveSource(null); setPinnedSourceNames(new Set());
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
    const tag = (field: FieldInfo): MultiField => ({ ...field, sourceName: source.name });

    const nextGroupBy: MultiField[] = [];
    const nextGranularity: Record<string, Granularity> = {};

    for (const entry of pendingHydration.groupBy) {
      const parsed = parseGroupByEntry(entry);
      const field = findField(parsed.name);
      if (!field) continue;
      nextGroupBy.push(tag(field));
      if (parsed.granularity) nextGranularity[`${source.name}::${field.name}`] = parsed.granularity;
    }

    const nextAgg = pendingHydration.agg
      .map((name) => findField(name))
      .filter((f): f is FieldInfo => !!f)
      .map(tag);

    const nextSort: (SortItem & { field: MultiField })[] = [];
    if (pendingHydration.orderBy) {
      for (const [fieldName, dir] of Object.entries(pendingHydration.orderBy)) {
        const field = findField(fieldName);
        if (!field) continue;
        nextSort.push({ field: tag(field), dir: dir === "desc" ? "desc" : "asc" });
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

  // Sources whose fields are currently selectable/filterable — the active
  // one plus any pinned alongside it.
  const includedSources = useMemo(
    () => (activeSource ?? []).filter((s) => s.name === activeSchema?.name || pinnedSourceNames.has(s.name)),
    [activeSource, activeSchema, pinnedSourceNames],
  );
  const otherIncludedSources = useMemo(
    () => includedSources.filter((s) => s.name !== activeSchema?.name),
    [includedSources, activeSchema],
  );

  // Filter fields merged across every included source. With just one
  // source (the common case) field ids stay bare, exactly as before —
  // preserving already-saved filters. Once a second source is pinned,
  // ids are qualified ("source::field") so same-named fields from
  // different sources stay distinct, and the label shows the source too.
  const filterableFields = useMemo(() => {
    if (includedSources.length <= 1) return includedSources.flatMap((s) => s.schema?.fields ?? []);
    return includedSources.flatMap((s) =>
      (s.schema?.fields ?? []).map((f) => ({ ...f, name: `${s.name}::${f.name}`, label: `${s.name}.${f.name}` })),
    );
  }, [includedSources]);

  const generatedQuery = useMemo(() => {
    if (!activeSchema) return null;

    try {
      const builder = new CubeQueryBuilder(activeSchema, otherIncludedSources);

      for (const field of groupByFields) {
        builder.addGroupBy(field.name, granularityMap[`${field.sourceName}::${field.name}`], field.sourceName);
      }
      for (const field of aggFields) {
        builder.addAgg(field, field.sourceName);
      }
      // Always capped here, regardless of limitOnDashboard — the builder's
      // own preview/Run must stay cheap to iterate on.
      if (limit > 0) {
        builder.setLimit(limit);
      }

      const activeGroupKeys = groupByFields.map((f) => `${f.sourceName}::${f.name}`);
      for (const sortItem of sortMap) {
        if (!activeGroupKeys.includes(`${sortItem.field.sourceName}::${sortItem.field.name}`)) continue;
        builder.addSort(sortItem.field, sortItem.dir === "asc" ? "asc" : "desc", sortItem.field.sourceName);
      }

      if (filterQuery && filterQuery.rules && filterQuery.rules.length > 0) {
        const { where, having } = partitionFilterQuery(filterQuery, filterableFields);
        if (where) builder.addFilter(where);
        if (having) builder.addHaving(having);
      }

      return builder.buildQuery();
    } catch (e: any) {
      console.error("Failed building Cube query:", e);
      return null;
    }
  }, [groupByFields, aggFields, limit, sortMap, filterQuery, granularityMap, activeSchema, otherIncludedSources, filterableFields]);

  // Pipes the built query straight into the editable/persisted state, unless
  // a saved-query hydration is still in flight (that owns `query` until done).
  useEffect(() => {
    if (generatedQuery && !suppressCodegen.current) {
      setQuery(generatedQuery);
    }
  }, [generatedQuery]);

  // ── Toggle field ─────────────────────────────────────────────────────────
  function toggleField(field: FieldInfo, sourceName: string) {
    const kind = field.kind.toLowerCase();
    const tagged: MultiField = { ...field, sourceName };
    if (kind === "measure") {
      setAggFields((prev) => prev.some((f) => sameField(f, field.name, sourceName)) ? prev.filter((f) => !sameField(f, field.name, sourceName)) : [...prev, tagged]);
    } else {
      setGroupByFields((prev) => {
        const wasSelected = prev.some((f) => sameField(f, field.name, sourceName));
        const next = wasSelected ? prev.filter((f) => !sameField(f, field.name, sourceName)) : [...prev, tagged];
        // clear granularity if deselected
        if (wasSelected) setGranularityMap((g) => { const c = { ...g }; delete c[`${sourceName}::${field.name}`]; return c; });
        return next;
      });
    }
    // clear sort if deselected
    setSortMap((prev) => {
      const isSelected = kind === "measure" ? aggFields.some((f) => sameField(f, field.name, sourceName)) : groupByFields.some((f) => sameField(f, field.name, sourceName));
      if (isSelected) { return prev.filter((s) => !sameField(s.field, field.name, sourceName)); }
      return prev;
    });
  }

  // ── Toggle sort ───────────────────────────────────────────────────────────
  function cycleSort(e: React.MouseEvent<HTMLDivElement>, field: FieldInfo, sourceName: string) {
    e.preventDefault();
    e.stopPropagation();

    const tagged: MultiField = { ...field, sourceName };
    setSortMap((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const existing = current.find((s) => sameField(s.field, field.name, sourceName));

      if (!existing) {
        return [...current, { field: tagged, dir: "asc" }];
      }
      if (existing.dir === "asc") {
        return current.map((s) =>
          sameField(s.field, field.name, sourceName) ? { ...s, dir: "desc" as const } : s
        );
      }
      return current.filter((s) => !sameField(s.field, field.name, sourceName));
    });
  }

  // ── Set granularity ───────────────────────────────────────────────────────
  function setGranularity(e: React.MouseEvent, sourceName: string, fieldName: string, gran: Granularity) {
    e.stopPropagation();
    setGranularityMap((prev) => ({ ...prev, [`${sourceName}::${fieldName}`]: gran }));
  }

  // ── Toggle a source's inclusion alongside the active one ────────────────
  function togglePinnedSource(sourceName: string) {
    setPinnedSourceNames((prev) => {
      const next = new Set(prev);
      next.has(sourceName) ? next.delete(sourceName) : next.add(sourceName);
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function buildSavePayload(): DatasetCreate | null {
    const name = datasetName?.trim();
    if (!name || !selectedDefinitionId || !activeSchema || !query) return null;

    const groupBy = buildGroupByFields(groupByFields, (f) => granularityMap[`${(f as MultiField).sourceName}::${f.name}`]);
    const orderBy = buildOrderByFields(sortMap);
    const { where, having } = partitionFilterQuery(filterQuery, filterableFields);
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
      limit_enabled: limitOnDashboard,
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

      {modelsError && (
        <div className="px-4 py-2">
          <CAlert variant="error" message={modelsError} />
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

        <div className="flex items-center gap-2 pl-3 ml-1" style={{ borderLeft: "1px solid var(--border)" }}>
          {loadingModels ? (
            <CSpinner size={14} />
          ) : (
            <>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="rounded-lg border px-2 py-1 text-xs outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
                style={{ background: "var(--bg)", color: selectedModelId ? "var(--text-h)" : "var(--text)", borderColor: "var(--border)" }}
              >
                <option value="" disabled>Model…</option>
                {modelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                value={selectedDefinitionId}
                onChange={(e) => setSelectedDefinitionId(e.target.value)}
                disabled={!selectedModelId}
                className="rounded-lg border px-2 py-1 text-xs outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--bg)", color: selectedDefinitionId ? "var(--text-h)" : "var(--text)", borderColor: "var(--border)" }}
              >
                <option value="" disabled>Definition…</option>
                {definitionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                type="button"
                onClick={loadSchema}
                disabled={!selectedDefinitionId || loadingSchema}
                title="Refresh Definition"
                className="flex shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-[var(--accent-muted)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "var(--text)" }}
              >
                {loadingSchema ? <CSpinner size={12} /> : <MdRefresh size={14} />}
              </button>
            </>
          )}
        </div>

        <div className="flex-1" />

        <CToggleButtons buttons={[
          {label: "Table", value: "table", icon: FaTable},
          {label: "JSON", value: "json", icon: FaCode},
          {label: "Cube", value: "cube", icon: FaDatabase , disabled: query === null},
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
          {/* Schema browser */}
          <div className="flex-1 overflow-y-auto py-1">
            {schemaError && <div className="p-3"><CAlert variant="error" message={schemaError} /></div>}
            {loadingSchema && <div className="flex justify-center py-8"><CSpinner size={20} /></div>}

            {activeSource?.map((schema: SourceInfo) => {
              const srcActive = activeSchema?.name === schema.name;
              const pinned = pinnedSourceNames.has(schema.name);
              const included = srcActive || pinned;
              const granPrefix = `${schema.name}::`;
              const scopedGranularityMap = Object.fromEntries(
                Object.entries(granularityMap)
                  .filter(([k]) => k.startsWith(granPrefix))
                  .map(([k, v]) => [k.slice(granPrefix.length), v]),
              );
              return (
                <div key={schema.name}>
                  {/* Source row */}
                  <div
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                    style={srcActive ? { background: "var(--accent-muted)", color: "var(--accent)" } : { color: "var(--text-h)" }}
                  >
                    <button type="button" onClick={() => setActiveSchema(schema)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <FaLayerGroup size={12} style={{ color: srcActive ? "var(--accent)" : "var(--text)" }} />
                      <span className="truncate text-xs font-semibold">{schema.name}</span>
                      <span className="ml-auto shrink-0 text-[10px]" style={{ color: "var(--text)" }}>{schema.schema?.fields.length}</span>
                    </button>
                    {!srcActive && (
                      <button type="button" onClick={() => togglePinnedSource(schema.name)}
                        title={pinned ? "Stop including this source" : "Include this source alongside the active one"}
                        className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--border)]"
                      >
                        <FaThumbtack size={10} style={{ color: pinned ? "var(--accent)" : "var(--text)" }} />
                      </button>
                    )}
                  </div>

                  {/* Field tree */}
                  {included && (
                    <CFieldTree
                      fields={schema.schema.fields}
                      groupByFields={groupByFields.filter((f) => f.sourceName === schema.name)}
                      aggFields={aggFields.filter((f) => f.sourceName === schema.name)}
                      granularityMap={scopedGranularityMap}
                      sortMap={sortMap.filter((s) => s.field.sourceName === schema.name)}
                      onToggleField={(f) => toggleField(f, schema.name)}
                      onSetGranularity={(e, name, g) => setGranularity(e, schema.name, name, g)}
                      onCycleSort={(e, f) => cycleSort(e, f, schema.name)}
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
            fields={filterableFields}
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

              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Limit</span>
                <input type="number" value={limit} onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))} min={1}
                  className="w-20 rounded-lg border px-2 py-1 text-right text-xs outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
                  style={{ background: "var(--bg)", color: "var(--text-h)", borderColor: "var(--border)" }}
                />
                <span className="text-xs" style={{ color: "var(--text)" }}>on dashboards</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={limitOnDashboard}
                  title={limitOnDashboard
                    ? "Dashboards using this dataset also get this limit — click to have them fetch the full data instead"
                    : "Dashboards using this dataset fetch the full, unlimited data — click to cap them at this limit too"}
                  onClick={() => setLimitOnDashboard((v) => !v)}
                  className="relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors"
                  style={{ background: limitOnDashboard ? "var(--accent)" : "var(--border)" }}
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: limitOnDashboard ? "translateX(16px)" : "translateX(2px)" }}
                  />
                </button>
              </div>
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
