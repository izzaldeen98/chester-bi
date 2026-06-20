import { useEffect, useMemo, useState } from "react";
import {
  FaPlay, FaTable, FaLayerGroup, FaCalendarAlt, FaFilter, FaTrash
} from "react-icons/fa";
import { FaSortAmountDown } from "react-icons/fa";
import { IoText } from "react-icons/io5";
import { TbRulerMeasure2 } from "react-icons/tb";
import { MdDataObject } from "react-icons/md";
import { PiFileSqlFill } from "react-icons/pi";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";
import CSelect from "../components/CSelect";
import CTable from "../components/CTable";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import { useTheme } from "../lib/theme";
import {
  listModels,
  getCompiledModel,
  runQuery,
  type ModelPackage,
  type SemanticModelSchema,
} from "../lib/Api";
import 'react-querybuilder/dist/query-builder.css';
import '../styles/query-builder.css';
import { BsArrowsCollapse, BsArrowsExpand } from "react-icons/bs";


import { ASTQuery  } from "@malloydata/malloy-query-builder";
import { Malloy } from '@malloydata/malloy/dist/malloy';
import { FieldInfo, SourceInfo } from "@malloydata/malloy-interfaces";
import { QueryBuilder, type RuleGroupType } from "react-querybuilder"


// ── Constants ──────────────────────────────────────────────────────────────
const TIME_GRANULARITIES = ["year", "quarter", "month", "week", "day", "hour", "minute", "second"] as const;
type Granularity = typeof TIME_GRANULARITIES[number];
type SortDir = "asc" | "desc";
type ResultView = "table" | "json" | "query";

interface SortItem {
  field: FieldInfo;
  dir: SortDir;
}


function isDateTime(field: FieldInfo) {
  const dt = field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "timestamp_type";
  return dt;
}

function isBoolean(field: FieldInfo) {  
  return field.kind.toLowerCase() === "dimension" && 'type' in field && field.type.kind.toLowerCase() === "boolean_type";
}



// ── Helpers ────────────────────────────────────────────────────────────────


function extractRows(result: any): Record<string, unknown>[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.result)) return result.result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.results)) return result.results;
  return [];
}

function extractColumns(rows: Record<string, unknown>[]): string[] {
  return rows.length > 0 ? Object.keys(rows[0]) : [];
}

function countFilterRules(group: RuleGroupType): number {
  return group.rules.reduce<number>((count, rule) => {
    if ("rules" in rule) return count + countFilterRules(rule);
    return count + 1;
  }, 0);
}

const EMPTY_FILTER_QUERY: RuleGroupType = { combinator: "and", rules: [] };

// ── Field icon ─────────────────────────────────────────────────────────────
function FieldIcon({ field }: { field: FieldInfo }) {
  if (field.kind.toLowerCase() === "measure")
    return <TbRulerMeasure2 size={13} style={{ color: "#a78bfa", flexShrink: 0 }} />;
  if (isDateTime(field))
    return <FaCalendarAlt size={11} style={{ color: "#34d399", flexShrink: 0 }} />;
  return <IoText size={13} style={{ color: "var(--text)", flexShrink: 0 }} />;
}


// ── Page ───────────────────────────────────────────────────────────────────
export default function QueryPage() {
  const { theme } = useTheme();

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
  const [collapseFilters, setCollapseFilters] = useState(true);

  function queryBuilderDataType(field: FieldInfo): string {
    const isMeasure = field.kind.toLowerCase() === "measure";
    const isDimension = field.kind.toLowerCase() === "dimension";
    const isDT = isDateTime(field);
    const isBool = isBoolean(field);
    if (isMeasure) return "number";
    if (isDimension && isDT) return "datetime-local";
    if (isDimension) return "text";

    return "text";
  }

  function queryBuilderValueEditorType(field: FieldInfo): string {
    const isMeasure = field.kind.toLowerCase() === "measure";
    const isDimension = field.kind.toLowerCase() === "dimension";
    const isDT = isDateTime(field);
    const isBool = isBoolean(field);
    if (isMeasure) return "text";
    if (isDimension && isDT) return "text";
    if (isDimension && isBool) return "switch";
    return "text";
  }

  // Filters (react-querybuilder)
  const [filterQuery, setFilterQuery] = useState<RuleGroupType>(EMPTY_FILTER_QUERY);
  const filterRuleCount = useMemo(() => countFilterRules(filterQuery), [filterQuery]);

  const filterFields = useMemo(
    () => activeSchema?.schema?.fields?.map((field: FieldInfo) => ({
      name: field.name,
      label: field.name,
      inputType: queryBuilderDataType(field),
      valueEditorType: queryBuilderValueEditorType(field),

    })) ?? [],
    [activeSchema],
  );

  // Results
  const [running, setRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState("");
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const [resultView, setResultView] = useState<ResultView>("table");

  // ── Load models ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingModels(true);
    listModels()
      .then((pkgs) => {
        setModelPackages(pkgs);
        if (pkgs.length > 0) {
          //   setSelectedPkgId(pkgs[0].id);
          setSelectedPkgId("");
          //   if (pkgs[0].models.length > 0) setSelectedModelId(pkgs[0].models[0].id);
          if (pkgs[0].models.length > 0) setSelectedModelId("");

        }
      })
      .catch((e: any) => setModelsError(e.message ?? "Failed to load models."))
      .finally(() => setLoadingModels(false));
  }, []);

  const selectedPkg = modelPackages.find((p) => p.id === selectedPkgId);
  const pkgOptions = modelPackages.map((p) => ({ label: p.name, value: p.id }));
  const modelOptions = (selectedPkg?.models ?? []).map((m) => ({ label: m.name, value: m.id }));

  useEffect(() => {
    const pkg = modelPackages.find((p) => p.id === selectedPkgId);
    if (pkg && pkg.models.length > 0) setSelectedModelId("");
    else setSelectedModelId("");
  }, [selectedPkgId]);

  // ── Load schema ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedModelId) return;
    setCompiledModel(null); setSchemaError(""); setActiveSource(null);
    setGroupByFields([]); setAggFields([]); setGranularityMap({}); setSortMap([]); setFilterQuery(EMPTY_FILTER_QUERY);
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


  const generatedQuery = useMemo(() => {
    if (!activeSchema) return;
    const query = new ASTQuery({ source: activeSchema });
    const segment = query.getOrAddDefaultSegment();
    if (groupByFields.length > 0) {
      for (const field of groupByFields) {
        const isDimension = field.kind.toLowerCase() === "dimension";
        if (isDimension && 'type' in field && field.type.kind.toLowerCase() === "timestamp_type" && granularityMap[field.name]) {
          segment.addTimestampGroupBy(field.name, granularityMap[field.name]);
        } else {
          segment.addGroupBy(field.name);
        }
      }
    }
    if (aggFields.length > 0) {
      for (const field of aggFields) {
        segment.addAggregate(field.name);
      }
    }
    // if (filters.length > 0) {
    //   for (const filter of filters) {
    //     segment.addwhere(filter.field, filter.op, filter.value);
    //   }
    // }
    if (limit > 0) {
      segment.setLimit(limit);
    }
    if (sortMap.length > 0) {
      for (const sortItem of sortMap) {
        if (!groupByFields.includes(sortItem.field)) return;
        console.log(groupByFields.includes(sortItem.field));
        segment.addOrderBy(sortItem.field.name, sortItem.dir === "asc" ? "asc" : "desc");
      }
    }
    const malloyQuery = query.toMalloy();
    setQuery(malloyQuery);

    return malloyQuery;

  }, [groupByFields, aggFields, filterQuery, limit, sortMap, granularityMap, activeSchema]);

  // ── Toggle field ─────────────────────────────────────────────────────────
  function toggleField(field: FieldInfo) {

    const isMeasure = field.kind.toLowerCase() === "measure";
    if (isMeasure) {
      setAggFields((prev) => prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]);
    } else {
      setGroupByFields((prev) => {
        const next = prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field];
        // clear granularity if deselected
        if (prev.includes(field)) setGranularityMap((g) => { const c = { ...g }; delete c[field.name]; return c; });
        return next;
      });
    }
    // clear sort if deselected
    setSortMap((prev) => {
      const isSelected = isMeasure ? aggFields.includes(field) : groupByFields.includes(field);
      if (isSelected) { return prev.filter((s) => s.field.name !== field.name); }
      return prev;
    });
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
        console.log("Action: Adding ASC");
        return [...current, { field, dir: "asc" }];
      }

      // State 2: Current is ASC -> Update to DESC
      if (existing.dir === "asc") {
        console.log("Action: Flipping to DESC");
        return current.map((s) =>
          s.field.name === field.name ? { ...s, dir: "desc" as const } : s
        );
      }
    

      // State 3: Current is DESC -> Remove completely
      console.log("Action: Removing sort completely");
      return current.filter((s) => s.field.name !== field.name);
    });
  }

  function cycleCollapseFilters() {
    setCollapseFilters((prev) => !prev);
  }
  // ── Set granularity ───────────────────────────────────────────────────────
  function setGranularity(e: React.MouseEvent, fieldName: string, gran: Granularity) {
    e.stopPropagation();
    setGranularityMap((prev) => ({ ...prev, [fieldName]: gran }));
  }

  // ── Filter management ────────────────────────────────────────────────────
  useEffect(() => {
    console.log(filterQuery);
  }, [filterQuery]);
  // ── Run ───────────────────────────────────────────────────────────────────
  async function handleRun() {
    if (!selectedModelId || !generatedQuery) return;
    setRunning(true); setQueryError(""); setQueryResult(null); setQueryTime(null);
    try {
      const result = await runQuery(selectedModelId, generatedQuery);
      setQueryTime(result?.time ?? null);
      setQueryResult(result);
      setResultView("table");
    } catch (e: any) {
      setQueryError(e.message ?? "Query failed.");
    } finally { setRunning(false); }
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* Top bar */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}
      >
        <PiFileSqlFill size={18} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-bold" style={{ color: "var(--text-h)" }}>Query Builder</span>
        <div className="flex-1" />

        {/* View tabs */}
        {(["table", "json"] as ResultView[]).map((v) => {
          const meta: Record<ResultView, { label: string; icon: React.ReactNode }> = {
            table: { label: "Table", icon: <FaTable size={12} /> },
            json: { label: "JSON", icon: <MdDataObject size={14} /> },
            query: { label: "Query", icon: null },
          };
          const active = resultView === v;
          return (
            <button key={v} onClick={() => setResultView(v)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={active
                ? { background: "var(--accent)", color: "var(--accent-fg)" }
                : { color: "var(--text)", background: "transparent" }}
            >
              {meta[v].icon} {meta[v].label}
            </button>
          );
        })}

        {queryTime !== null && (
          <span className="text-xs" style={{ color: "var(--text)" }}>{queryTime.toFixed(3)}s</span>
        )}

        <button onClick={handleRun} disabled={!generatedQuery || running}
          className="flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {running ? <CSpinner size={12} /> : <FaPlay size={11} />} Run
        </button>
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

          {/* Selected chips */}
          {(groupByFields.length > 0 || aggFields.length > 0) && (
            <div className="flex flex-col gap-1.5 p-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Selected</p>
              <div className="flex flex-wrap gap-1">
                {groupByFields.map((f) => (
                  <button key={f.name} onClick={() => setGroupByFields((p) => p.filter((x) => x !== f))}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
                    title="Click to remove"
                  >
                    <IoText size={8} /> {f.name}{granularityMap[f.name] ? `.${granularityMap[f.name]}` : ""} ×
                  </button>
                ))}
                {aggFields.map((f) => (
                  <button key={f.name} onClick={() => setAggFields((p) => p.filter((x) => x !== f))}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "#ede9fe", color: "#7c3aed", border: "1px solid #c4b5fd" }}
                    title="Click to remove"
                  >
                    <TbRulerMeasure2 size={9} /> {f.name} ×
                  </button>
                ))}
              </div>
            </div>
          )}

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

                  {/* Fields */}
                  {srcActive && schema.schema.fields.map((field: FieldInfo) => {
                    const isMeasure = field.kind.toLowerCase() === "measure";
                    const inGroupBy = groupByFields.includes(field);
                    const inAgg = aggFields.includes(field);
                    const isSelected = inGroupBy || inAgg;
                    const sortDir = sortMap.find((s) => s.field === field)?.dir ?? "";
                    const gran = granularityMap[field.name];
                    const isDatetime = isDateTime(field);

                    return (
                      <div key={field.name} className="flex flex-row items-center">
                        {/* Field row */}
                        <div className="flex flex-col gap-1 w-full" >
                          <div
                            className="flex w-full items-center gap-1.5 py-1.5 pl-6 pr-2 cursor-pointer transition-colors"
                            style={isSelected
                              ? { background: isMeasure ? "#ede9fe" : "var(--accent-muted)", color: isMeasure ? "#7c3aed" : "var(--accent)" }
                              : { color: "var(--text-h)" }}
                            onClick={() => toggleField(field)}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--border)"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = ""; }}
                          >
                            <FieldIcon field={field} />
                            <span className="flex-1 truncate text-xs">{field.name}</span>

                          </div>
                          {isSelected && isDatetime && !isMeasure && (
                            <div className="flex flex-col gap-1 pb-1.5 pl-10 pr-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {TIME_GRANULARITIES.map((g) => (
                                <span
                                  key={g}
                                  className="px-1.5 py-0.5 text-[9px] font-semibold transition-colors cursor-pointer"
                                  onClick={(e) => setGranularity(e, field.name, g)}
                                  style={gran === g
                                    ? { background: "var(--accent)", color: "var(--accent-fg)" }
                                    : { background: "var(--border)", color: "var(--text)" }}
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div
                          className="flex flex-row gap-1 transition-colors cursor-pointer items-center pl-2 pr-2 left-full"
                          hidden={!isSelected}
                          onClick={(e) => cycleSort(e, field)}
                        >
                          <FaSortAmountDown
                            size={11}
                            style={{ transform: sortDir === "asc" ? "scaleY(-1)" : undefined, color: sortDir ? "var(--accent)" : "var(--text)" }}
                          />
                          {/* <FaGear size={11} style={{ color: "var(--accent)" }} /> */}
                          <span className="text-[9px] font-bold" style={{ color: "var(--accent)" }}>
                            {sortDir.toUpperCase()}
                          </span>

                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Right main area ─────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">

          {/* Filter builder panel */}
          <div className="query-builder-section shrink-0">
            <div className="query-builder-section-header">
              <span className="flex items-center gap-1">
                {collapseFilters ? <BsArrowsExpand size={14} className="cursor-pointer var(--text)" onClick={cycleCollapseFilters} /> : <BsArrowsCollapse size={14} className="cursor-pointer var(--accent)" onClick={cycleCollapseFilters} />}
              </span>
              <FaFilter size={11} style={{ color: "var(--accent)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-h)" }}>Filters</span>
              {filterRuleCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilterQuery(EMPTY_FILTER_QUERY)}
                  className="ml-auto text-[10px] font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--text)" }}
                >
                  Clear all
                </button>
              ) : (
                <span className="qb-header-hint">
                  Add rules below to filter your query results
                </span>
              )}
            </div>

            <div
              className={`query-builder-panel${filterRuleCount === 0 ? " query-builder-panel--empty" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              hidden={collapseFilters}
            >
              <QueryBuilder
                fields={filterFields}
                query={filterQuery}
                onQueryChange={setFilterQuery}
                showCombinatorsBetweenRules
                controlClassnames={{
                  queryBuilder: "qb-modern-compact queryBuilder-branches queryBuilder-responsive",
                }}
                translations={{
                  addRule: { label: "+ Rule", title: "Add filter rule" },
                  addGroup: { label: "+ Group", title: "Add filter group" },
                  removeRule: { label: "×", title: "Remove rule" },
                  removeGroup: { label: "×", title: "Remove group" },
                }}
              />
            </div>
          </div>

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
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
