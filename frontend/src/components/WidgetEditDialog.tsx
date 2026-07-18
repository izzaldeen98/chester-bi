import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FaSearch,
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaTable,
  FaDatabase,
  FaCheck,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { PiFileSqlFill } from "react-icons/pi";
import { IoGridOutline } from "react-icons/io5";
import { MdDashboard } from "react-icons/md";
import CDialog from "./CDialog";
import CTextInput from "./CTextInput";
import CAlert from "./CAlert";
import CSpinner from "./CSpinner";
import CButton from "./CButton";
import CardChart from "./charts/CardChart/CardChart";
import LineChart from "./charts/LineChart";
import BarChart from "./charts/BarChart";
import PieChart from "./charts/PieChart";
import TableChart from "./charts/TableChart";
import { CardSchema, LineChartSchema, BarChartSchema, PieChartSchema, TableChartSchema } from "./charts/ChartsSchemas";
import { getQueries, getQuery, runQuery, getCompiledModel, type QueryPublicResponse, type QueryDetailedResponse, type SemanticModelSchema } from "../lib/Api";
import { normalizeQueryRows } from "../lib/queryResult";
import { isDateTimeTypeKind, resolveXAxisFieldType } from "../lib/fieldTypes";
import { VscDebugRerun } from "react-icons/vsc";

type ChartType = "card" | "line" | "bar" | "pie" | "table";

export type { ChartType };

export interface WidgetChartConfig {
  queryId?: string;
  queryName?: string;
  chartType?: ChartType;
  chartConfig?: Record<string, string>;
  previewValue?: number | null;
  previewRows?: Record<string, unknown>[] | null;
}

export interface WidgetSaveResult {
  query: QueryPublicResponse;
  chartType: ChartType;
  chartConfig: Record<string, string>;
  previewValue: number | null;
  previewRows: Record<string, unknown>[] | null;
}

interface SchemaField {
  name: string;
  inputType: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  showWhen?: string;
  options?: { value: string; label: string }[];
}

function isConfigTruthy(value: string | undefined) {
  return value === "true" || value === "1" || value === "on";
}

function shouldShowField(field: SchemaField, config: Record<string, string>) {
  if (field.inputType === "switch") return true;
  if (!field.showWhen) return true;
  return isConfigTruthy(config[field.showWhen]);
}

function normalizeFields(fields: Array<Record<string, unknown>>): SchemaField[] {
  return fields.map((raw) => ({
    name: String(raw.name ?? "").trim(),
    inputType: String(raw.inputType ?? "text").trim(),
    label: String(raw.label ?? ""),
    placeholder: raw.placeholder != null ? String(raw.placeholder) : undefined,
    required: Boolean(raw.required),
    defaultValue: raw.defaultValue != null ? String(raw.defaultValue) : undefined,
    showWhen: raw.showWhen != null ? String(raw.showWhen).trim() : undefined,
    options: Array.isArray(raw.options)
      ? raw.options.map((opt) => {
          const item = opt as Record<string, unknown>;
          return { value: String(item.value ?? ""), label: String(item.label ?? item.value ?? "") };
        })
      : undefined,
  }));
}

function extractRows(result: unknown): Record<string, unknown>[] {
  return normalizeQueryRows(result);
}

function readNumericCell(rows: Record<string, unknown>[], fieldName: string): number | null {
  if (!fieldName || rows.length === 0) return null;
  const raw = rows[0][fieldName];
  if (raw == null) return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(num) ? num : null;
}

function getFieldValue(config: Record<string, string>, field: SchemaField) {
  const current = config[field.name];
  if (current !== undefined && current !== "") return current;
  return field.defaultValue ?? "";
}

function buildDefaultCardConfig(title: string): Record<string, string> {
  const config: Record<string, string> = { ...DEFAULT_CARD_CONFIG, title };
  for (const field of normalizeFields(CardSchema.fields as Array<Record<string, unknown>>)) {
    if (field.defaultValue !== undefined && config[field.name] === undefined) {
      config[field.name] = field.defaultValue;
    }
  }
  return config;
}

interface ChartOption {
  type: ChartType;
  label: string;
  description: string;
  icon: ReactNode;
  schema?: { chartType: string; fields: SchemaField[] };
}

const CHART_OPTIONS: ChartOption[] = [
  {
    type: "card",
    label: "Card",
    description: "Single KPI with target progress",
    icon: <MdDashboard size={12} />,
    schema: { chartType: CardSchema.chartType, fields: normalizeFields(CardSchema.fields as Array<Record<string, unknown>>) },
  },
  {
    type: "line",
    label: "Line",
    description: "Trend over time or categories",
    icon: <FaChartLine size={11} />,
    schema: { chartType: LineChartSchema.chartType, fields: normalizeFields(LineChartSchema.fields as Array<Record<string, unknown>>) },
  },
  {
    type: "bar",
    label: "Bar",
    description: "Compare values across groups",
    icon: <FaChartBar size={11} />,
    schema: { chartType: BarChartSchema.chartType, fields: normalizeFields(BarChartSchema.fields as Array<Record<string, unknown>>) },
  },
  {
    type: "pie",
    label: "Pie",
    description: "Part-to-whole proportions",
    icon: <FaChartPie size={11} />,
    schema: { chartType: PieChartSchema.chartType, fields: normalizeFields(PieChartSchema.fields as Array<Record<string, unknown>>) },
  },
  {
    type: "table",
    label: "Table",
    description: "Tabular data with sorting & pagination",
    icon: <FaTable size={10} />,
    schema: { chartType: TableChartSchema.chartType, fields: normalizeFields(TableChartSchema.fields as Array<Record<string, unknown>>) },
  },
];

const FORMAT_OPTIONS = [
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "number", label: "Number" },
  { value: "decimal", label: "Decimal" },
];

const DEFAULT_CARD_CONFIG: Record<string, string> = {
  title: "",
  titleFontSize: "14",
  titleFontColor: "#111827",
  value: "128400",
  valueFontSize: "32",
  valueFontColor: "#111827",
  valueFormat: "currency",
  hasTarget: "false",
  target: "150000",
  targetFormat: "currency",
  targetBarColor: "#eab308",
};

const DEFAULT_SERIES_COLORS = [
  "#eab308",
  "#3b82f6",
  "#10b981",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
];

function parseConfigList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((part) => part.trim()).filter(Boolean);
}

function parseYAxisRows(value: string | undefined): string[] {
  if (!value?.trim()) return [""];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? parsed.map(String) : [""];
      }
    } catch {
      return [""];
    }
  }
  const parts = trimmed.split(",").map((part) => part.trim());
  return parts.length > 0 ? parts : [""];
}

function serializeConfigList(values: string[]): string {
  return JSON.stringify(values);
}

function YAxisFieldEditor({
  values,
  colors,
  options,
  onChange,
  onColorsChange,
}: {
  values: string[];
  colors: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  onColorsChange: (colors: string[]) => void;
}) {
  const rows = values.length > 0 ? values : [""];
  const baseInputClass =
    "w-full rounded-xl border bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-h)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)] border-[var(--border)]";

  function updateRow(index: number, value: string) {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  }

  function updateColor(index: number, color: string) {
    const next = [...colors];
    while (next.length < rows.length) {
      next.push(DEFAULT_SERIES_COLORS[next.length % DEFAULT_SERIES_COLORS.length]);
    }
    next[index] = color;
    onColorsChange(next);
  }

  function addRow() {
    onChange([...rows, ""]);
    onColorsChange([
      ...colors,
      DEFAULT_SERIES_COLORS[rows.length % DEFAULT_SERIES_COLORS.length],
    ]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      onChange([""]);
      onColorsChange([DEFAULT_SERIES_COLORS[0]]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
    onColorsChange(colors.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((rowValue, index) => {
        const usedElsewhere = new Set(rows.filter((_, i) => i !== index && rows[i]));
        const availableOptions = options.filter(
          (opt) => opt.value === rowValue || !usedElsewhere.has(opt.value),
        );
        const rowColor = colors[index] || DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length];

        return (
          <div key={index} className="flex items-center gap-2">
            <select
              value={rowValue}
              onChange={(e) => updateRow(index, e.target.value)}
              className={`${baseInputClass} min-w-0 flex-1`}
            >
              <option value="">Select field…</option>
              {availableOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="color"
              value={rowColor}
              onChange={(e) => updateColor(index, e.target.value)}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent p-0.5"
              title="Series color"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              aria-label="Remove Y axis"
            >
              <FaTimes size={12} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        disabled={options.length > 0 && rows.length >= options.length}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-[11px] font-medium transition-colors hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
      >
        <FaPlus size={10} /> Add Y axis
      </button>
    </div>
  );
}

function getQueryInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface WidgetEditDialogProps {
  isOpen: boolean;
  widgetTitle: string;
  initialConfig?: WidgetChartConfig;
  onClose: () => void;
  onSave?: (result: WidgetSaveResult | null) => void;
}

function StepBadge({ step, label, done, active }: { step: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{
          background: done ? "var(--accent)" : active ? "var(--accent-muted)" : "var(--bg)",
          color: done ? "var(--accent-fg)" : active ? "var(--accent)" : "var(--text)",
          border: `1px solid ${done || active ? "var(--accent-ring)" : "var(--border)"}`,
        }}
      >
        {done ? <FaCheck size={10} /> : step}
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: active || done ? "var(--text-h)" : "var(--text)" }}
      >
        {label}
      </span>
    </div>
  );
}

function SchemaFieldInput({
  field,
  value,
  onChange,
  options = [],
}: {
  field: SchemaField;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
}) {
  const baseInputClass =
    "w-full rounded-xl border bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-h)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)] border-[var(--border)]";

  if (field.inputType === "switch") {
    const on = isConfigTruthy(value);
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(on ? "false" : "true")}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
        style={{
          background: on ? "var(--accent)" : "var(--border)",
        }}
      >
        <span
          className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: on ? "translateX(22px)" : "translateX(4px)" }}
        />
      </button>
    );
  }

  if (field.inputType === "color") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#111827"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${baseInputClass} flex-1 font-mono text-xs`}
        />
      </div>
    );
  }

  if (field.inputType === "select") {
    const selectOptions =
      field.options?.length
        ? field.options
        : field.name.toLowerCase().includes("format")
          ? FORMAT_OPTIONS
          : options;
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClass}
      >
        <option value="">{field.placeholder ?? "Select…"}</option>
        {selectOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <CTextInput
      type={field.inputType === "number" ? "number" : "text"}
      value={value}
      onChange={onChange}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
}

export default function WidgetEditDialog({
  isOpen,
  widgetTitle,
  initialConfig,
  onClose,
  onSave,
}: WidgetEditDialogProps) {
  const isHydratingRef = useRef(false);
  const wasOpenRef = useRef(false);
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined);
  const [queries, setQueries] = useState<QueryPublicResponse[]>([]);
  const [queryDetails, setQueryDetails] = useState<QueryDetailedResponse | null>(null);
  const [compiledModel, setCompiledModel] = useState<SemanticModelSchema | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [chartConfig, setChartConfig] = useState<Record<string, string>>(() => buildDefaultCardConfig(""));
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;

    isHydratingRef.current = true;
    prevSelectedIdRef.current = undefined;
    setSearch("");
    setError("");
    setRunError("");
    setLoading(true);

    const savedConfig = initialConfig?.chartConfig;
    const title = savedConfig?.title || widgetTitle;

    setSelectedId(initialConfig?.queryId ?? null);
    setSelectedChart(initialConfig?.chartType ?? null);
    setChartConfig(
      savedConfig
        ? { ...buildDefaultCardConfig(title), ...savedConfig, title: savedConfig.title || widgetTitle }
        : buildDefaultCardConfig(widgetTitle),
    );
    setPreviewValue(initialConfig?.previewValue ?? null);
    setPreviewRows(initialConfig?.previewRows ?? null);
    setQueryDetails(null);

    getQueries()
      .then(setQueries)
      .catch((e: Error) => setError(e.message ?? "Failed to load queries."))
      .finally(() => {
        setLoading(false);
        isHydratingRef.current = false;
      });
  }, [isOpen, widgetTitle, initialConfig]);

  useEffect(() => {
    if (!selectedId) {
      setQueryDetails(null);
      setCompiledModel(null);
      if (prevSelectedIdRef.current !== undefined) {
        setPreviewValue(null);
        setPreviewRows(null);
        setRunError("");
      }
      prevSelectedIdRef.current = selectedId;
      return;
    }

    const queryChanged =
      prevSelectedIdRef.current !== undefined && prevSelectedIdRef.current !== selectedId;
    if (queryChanged) {
      setPreviewValue(null);
      setPreviewRows(null);
      setRunError("");
    }
    prevSelectedIdRef.current = selectedId;

    setDetailsLoading(true);
    getQuery(selectedId)
      .then(setQueryDetails)
      .catch(() => setQueryDetails(null))
      .finally(() => setDetailsLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!queryDetails?.semantic_model?.id) {
      setCompiledModel(null);
      return;
    }

    getCompiledModel(queryDetails.semantic_model.id)
      .then(setCompiledModel)
      .catch(() => setCompiledModel(null));
  }, [queryDetails?.semantic_model?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queries;
    return queries.filter(
      (query) =>
        query.name.toLowerCase().includes(q) ||
        query.description?.toLowerCase().includes(q) ||
        query.semantic_model.package.name.toLowerCase().includes(q) ||
        query.semantic_model.name.toLowerCase().includes(q),
    );
  }, [queries, search]);

  const selected = queries.find((q) => q.id === selectedId) ?? null;
  const activeSchema = CHART_OPTIONS.find((c) => c.type === selectedChart)?.schema;

  const hasTarget = isConfigTruthy(chartConfig.hasTarget);

  const fieldOptions = useMemo(() => {
    if (!queryDetails) return [];
    const dims = queryDetails.group_by_fields ?? [];
    const measures = queryDetails.aggregation_fields ?? [];
    const calculated = (queryDetails.calculated_fields ?? [])
      .map((f) => (f as { name?: string })?.name)
      .filter((name): name is string => !!name);
    return [...dims, ...measures, ...calculated].map((f) => ({ value: f, label: f }));
  }, [queryDetails]);

  const querySource = useMemo(() => {
    if (!compiledModel || !queryDetails?.source) return null;
    return compiledModel.sources.find((source) => source.name === queryDetails.source) ?? null;
  }, [compiledModel, queryDetails?.source]);

  const xAxisTypeKind = useMemo(
    () => resolveXAxisFieldType(chartConfig.xAxis, querySource),
    [chartConfig.xAxis, querySource],
  );

  const isXAxisDateTime = isDateTimeTypeKind(xAxisTypeKind);

  const visibleFields = useMemo(() => {
    if (!activeSchema) return [];
    return activeSchema.fields.filter((field) => {
      if (!shouldShowField(field, chartConfig)) return false;
      if (selectedChart === "line" && field.name === "format" && !isXAxisDateTime) return false;
      return true;
    });
  }, [activeSchema, chartConfig, selectedChart, isXAxisDateTime]);

  useEffect(() => {
    if (selectedChart !== "line" || isXAxisDateTime || !chartConfig.format) return;
    if (isConfigTruthy(chartConfig.xAxisIsDateTime)) return;
    setChartConfig((prev) => ({ ...prev, format: "" }));
  }, [selectedChart, isXAxisDateTime, chartConfig.format, chartConfig.xAxisIsDateTime]);

  const step1Done = !!selected;
  const step2Done = !!selectedChart;
  const canSave = step1Done && step2Done;

  function updateConfig(name: string, value: string) {
    setChartConfig((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "xAxis" && selectedChart === "line") {
        const source = compiledModel?.sources.find((item) => item.name === queryDetails?.source) ?? null;
        const typeKind = resolveXAxisFieldType(value, source);
        if (!isDateTimeTypeKind(typeKind)) {
          next.format = "";
        }
      }
      return next;
    });
  }

  function updateYAxisFields(values: string[]) {
    setChartConfig((prev) => {
      const colors = parseConfigList(prev.yAxisColor);
      const nextColors = values.map(
        (_, index) => colors[index] || DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length],
      );
      return {
        ...prev,
        yAxis: serializeConfigList(values),
        yAxisColor: serializeConfigList(nextColors),
      };
    });
  }

  function updateYAxisColors(colors: string[]) {
    setChartConfig((prev) => ({
      ...prev,
      yAxisColor: serializeConfigList(colors),
    }));
  }

  const yAxisValues = useMemo(() => parseYAxisRows(chartConfig.yAxis), [chartConfig.yAxis]);
  const yAxisColors = useMemo(() => {
    const colors = parseConfigList(chartConfig.yAxisColor);
    const rows = parseYAxisRows(chartConfig.yAxis);
    return rows.map((_, index) => colors[index] || DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length]);
  }, [chartConfig.yAxis, chartConfig.yAxisColor]);

  function selectChart(type: ChartType) {
    setSelectedChart(type);
    setPreviewValue(null);
    setPreviewRows(null);
    setRunError("");
    if (type === "card") {
      setChartConfig((prev) => ({
        ...buildDefaultCardConfig(prev.title || widgetTitle),
        ...prev,
        title: prev.title || widgetTitle,
        hasTarget: prev.hasTarget ?? "false",
      }));
    }
  }

  const chartYAxisFields = useMemo(() => parseConfigList(chartConfig.yAxis), [chartConfig.yAxis]);
  const isSeriesChart = selectedChart === "line" || selectedChart === "bar";
  const isRowsChart = selectedChart === "pie" || selectedChart === "table";

  const canRun =
    selectedChart === "card"
      ? !!queryDetails && !!chartConfig.value?.trim()
      : isSeriesChart
        ? !!queryDetails && !!chartConfig.xAxis?.trim() && chartYAxisFields.length > 0
        : isRowsChart
          ? !!queryDetails
          : false;

  async function runSeriesChart() {
    const xField = chartConfig.xAxis?.trim();
    const yFields = parseConfigList(chartConfig.yAxis);
    if (!xField) {
      setRunError("Select an X axis field before running the query.");
      return;
    }
    if (yFields.length === 0) {
      setRunError("Select at least one Y axis field before running the query.");
      return;
    }

    setRunning(true);
    setRunError("");

    try {
      const result = await runQuery(queryDetails!.semantic_model.id, queryDetails!.malloy_query);
      const rows = extractRows(result);

      if (rows.length === 0) {
        setRunError("Query returned no rows.");
        setPreviewRows(null);
        return;
      }

      setPreviewRows(rows);
      setPreviewValue(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Query execution failed.";
      setRunError(message);
      setPreviewRows(null);
    } finally {
      setRunning(false);
    }
  }

  async function runPieChart() {
    setRunning(true);
    setRunError("");
    try {
      const result = await runQuery(queryDetails!.semantic_model.id, queryDetails!.malloy_query);
      const rows = extractRows(result);
      if (rows.length === 0) {
        setRunError("Query returned no rows.");
        setPreviewRows(null);
        return;
      }
      setPreviewRows(rows);
      setPreviewValue(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Query execution failed.";
      setRunError(message);
      setPreviewRows(null);
    } finally {
      setRunning(false);
    }
  }

  async function handleRun() {
    if (!queryDetails || !selected) return;

    if (isRowsChart) {
      await runPieChart();
      return;
    }

    if (isSeriesChart) {
      await runSeriesChart();
      return;
    }

    const valueField = chartConfig.value?.trim();
    if (!valueField) {
      setRunError("Select a value field before running the query.");
      return;
    }

    setRunning(true);
    setRunError("");

    try {
      const result = await runQuery(queryDetails.semantic_model.id, queryDetails.malloy_query);
      const rows = extractRows(result);
      const num = readNumericCell(rows, valueField);

      if (num === null) {
        setRunError(
          rows.length === 0
            ? "Query returned no rows."
            : `Could not read "${valueField}" from the query result.`,
        );
        setPreviewValue(null);
        return;
      }

      setPreviewValue(num);
      setPreviewRows(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Query execution failed.";
      setRunError(message);
      setPreviewValue(null);
    } finally {
      setRunning(false);
    }
  }

  const displayValue = previewValue ?? (chartConfig.value ? Number(chartConfig.value) : null);
  const displayTarget = hasTarget ? Number(chartConfig.target) || 0 : undefined;

  async function handleSave() {
    if (!onSave || !selected || !selectedChart) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSave({
        query: selected,
        chartType: selectedChart,
        chartConfig: {
          ...chartConfig,
          ...(selectedChart === "line"
            ? { xAxisIsDateTime: isXAxisDateTime ? "true" : "false" }
            : {}),
        },
        previewValue,
        previewRows,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <CDialog
      isOpen={isOpen}
      title={`Edit ${widgetTitle}`}
      subtitle="Pick a query, choose a chart type, then configure the display"
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={!canSave}
      saveLabel="Apply"
    >
      {/* Progress steps */}
      <div className="flex h-full min-h-0 flex-1">
        {/* ── Left: queries ── */}
        <aside
          className="flex w-72 shrink-0 flex-col border-r"
          style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
        >
          <div className="shrink-0 border-b p-4" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                Queries
              </p>
              {!loading && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                >
                  {filtered.length}
                </span>
              )}
            </div>
            <CTextInput
              value={search}
              onChange={setSearch}
              placeholder="Search queries…"
              icon={<FaSearch size={12} />}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <CSpinner size={24} />
              </div>
            ) : error ? (
              <CAlert variant="error" message={error} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <PiFileSqlFill size={28} style={{ color: "var(--border)" }} />
                <p className="mt-2 text-sm" style={{ color: "var(--text)" }}>
                  {search ? "No queries match your search." : "No queries available yet."}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {filtered.map((query) => {
                  const isSelected = query.id === selectedId;
                  return (
                    <li key={query.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(query.id)}
                        className="w-full rounded-xl border p-2.5 text-left transition-all hover:brightness-[0.98]"
                        style={{
                          background: isSelected ? "var(--accent-muted)" : "var(--bg)",
                          borderColor: isSelected ? "var(--accent)" : "var(--border)",
                          boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                            style={{
                              background: isSelected ? "var(--accent)" : "var(--bg-subtle)",
                              color: isSelected ? "var(--accent-fg)" : "var(--accent)",
                              border: `1px solid ${isSelected ? "var(--accent)" : "var(--accent-ring)"}`,
                            }}
                          >
                            {getQueryInitials(query.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold" style={{ color: "var(--text-h)" }}>
                              {query.name}
                            </p>
                            <p className="mt-0.5 truncate text-[10px]" style={{ color: "var(--text)" }}>
                              {query.semantic_model.package.name} · {query.semantic_model.name}
                            </p>
                          </div>
                          {isSelected && (
                            <FaCheck size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Configuration (left) + Preview (center) ── */}
        <div className="flex min-w-0 flex-1">
          <aside
            className="flex w-80 shrink-0 flex-col border-r overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          >
            <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                Configuration
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!selected ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FaDatabase size={20} style={{ color: "var(--border)" }} />
                  <p className="mt-3 text-xs" style={{ color: "var(--text)" }}>
                    Select a query to configure
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="mb-4 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                    style={{ borderColor: "var(--accent-ring)", background: "var(--accent-muted)" }}
                  >
                    <PiFileSqlFill size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <span className="truncate text-[11px] font-medium" style={{ color: "var(--text-h)" }}>
                      {selected.name}
                    </span>
                    {detailsLoading && <CSpinner size={12} className="ml-auto" />}
                  </div>

                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                    Chart type
                  </p>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {CHART_OPTIONS.map((chart) => {
                      const isActive = selectedChart === chart.type;
                      return (
                        <button
                          key={chart.type}
                          type="button"
                          onClick={() => selectChart(chart.type)}
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all"
                          style={{
                            background: isActive ? "var(--accent-muted)" : "var(--bg-subtle)",
                            borderColor: isActive ? "var(--accent)" : "var(--border)",
                            color: isActive ? "var(--text-h)" : "var(--text)",
                          }}
                        >
                          <span
                            className="flex h-4 w-4 shrink-0 items-center justify-center"
                            style={{ color: isActive ? "var(--accent)" : "var(--text)" }}
                          >
                            {chart.icon}
                          </span>
                          {chart.label}
                        </button>
                      );
                    })}
                  </div>

                  {!selectedChart ? (
                    <div
                      className="rounded-xl border border-dashed py-10 text-center"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <IoGridOutline size={18} style={{ color: "var(--border)" }} />
                      <p className="mt-2 text-[11px]" style={{ color: "var(--text)" }}>
                        Pick a chart type
                      </p>
                    </div>
                  ) : activeSchema ? (
                    <div className="flex flex-col gap-3">
                      {visibleFields.map((field) => {
                        if (field.inputType === "multi-select" && field.name === "yAxis") {
                          return (
                            <div key={field.name}>
                              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-h)" }}>
                                {field.label}
                                {field.required && <span className="ml-0.5 text-[var(--accent)]">*</span>}
                              </label>
                              {fieldOptions.length === 0 ? (
                                <p className="text-[11px]" style={{ color: "var(--text)" }}>
                                  Select a query with fields to choose Y axis values.
                                </p>
                              ) : (
                                <YAxisFieldEditor
                                  values={yAxisValues}
                                  colors={yAxisColors}
                                  options={fieldOptions}
                                  onChange={updateYAxisFields}
                                  onColorsChange={updateYAxisColors}
                                />
                              )}
                            </div>
                          );
                        }

                        if (field.inputType === "multi-select" && field.name === "columns") {
                          const selectedCols: string[] = (() => {
                            try {
                              const v = chartConfig.columns?.trim();
                              if (!v) return [];
                              return JSON.parse(v);
                            } catch { return []; }
                          })();
                          function toggleCol(col: string) {
                            const next = selectedCols.includes(col)
                              ? selectedCols.filter((c) => c !== col)
                              : [...selectedCols, col];
                            updateConfig("columns", next.length ? JSON.stringify(next) : "");
                          }
                          return (
                            <div key={field.name}>
                              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-h)" }}>
                                {field.label}
                              </label>
                              {fieldOptions.length === 0 ? (
                                <p className="text-[11px]" style={{ color: "var(--text)" }}>
                                  Select a query to choose columns.
                                </p>
                              ) : (
                                <div className="flex flex-col gap-1 rounded-xl border p-2" style={{ borderColor: "var(--border)" }}>
                                  {fieldOptions.map((opt) => {
                                    const checked = selectedCols.includes(opt.value);
                                    return (
                                      <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-[var(--bg-subtle)]">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleCol(opt.value)}
                                          className="accent-[var(--accent)]"
                                        />
                                        <span className="text-xs" style={{ color: "var(--text-h)" }}>{opt.label}</span>
                                      </label>
                                    );
                                  })}
                                  {selectedCols.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => updateConfig("columns", "")}
                                      className="mt-1 text-[10px] text-left"
                                      style={{ color: "var(--accent)" }}
                                    >
                                      Clear selection (show all)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (field.inputType === "multi-color" && field.name === "yAxisColor") {
                          return null;
                        }

                        return (
                        <div
                          key={field.name}
                          className={
                            field.inputType === "switch"
                              ? "flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                              : ""
                          }
                          style={
                            field.inputType === "switch"
                              ? { borderColor: "var(--border)", background: "var(--bg-subtle)" }
                              : undefined
                          }
                        >
                          <label
                            className={`block text-xs font-medium ${field.inputType === "switch" ? "mb-0" : "mb-1"}`}
                            style={{ color: "var(--text-h)" }}
                          >
                            {field.label}
                            {field.required && <span className="ml-0.5 text-[var(--accent)]">*</span>}
                          </label>
                          <SchemaFieldInput
                            field={field}
                            value={getFieldValue(chartConfig, field)}
                            onChange={(v) => updateConfig(field.name, v)}
                            options={fieldOptions}
                          />
                        </div>
                        );
                      })}

                      {(selectedChart === "card" || isSeriesChart || isRowsChart) && (
                        <CButton
                          variant="outline"
                          fullWidth
                          loading={running}
                          disabled={!canRun}
                          onClick={handleRun}
                          className="!text-xs"
                        >
                          <VscDebugRerun size={14} /> Run query
                        </CButton>
                      )}

                      {runError && <CAlert variant="error" message={runError} />}
                      {selectedChart === "card" && previewValue != null && (
                        <p className="text-[11px]" style={{ color: "var(--text)" }}>
                          Loaded value: <span className="font-semibold" style={{ color: "var(--text-h)" }}>{previewValue.toLocaleString()}</span>
                        </p>
                      )}
                      {(isSeriesChart || isRowsChart) && previewRows != null && (
                        <p className="text-[11px]" style={{ color: "var(--text)" }}>
                          Loaded <span className="font-semibold" style={{ color: "var(--text-h)" }}>{previewRows.length}</span> row{previewRows.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </aside>

          <section
            className="flex min-w-0 flex-1 flex-col"
            style={{ background: "var(--bg-subtle)" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                Preview
              </p>
              {(selectedChart === "card" || isSeriesChart || isRowsChart) && selected && (
                <CButton
                  variant="primary"
                  loading={running}
                  disabled={!canRun}
                  onClick={handleRun}
                  className="!px-2.5 !py-1 !text-[11px]"
                >
                  <VscDebugRerun size={13} /> Run
                </CButton>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-auto p-6 pt-5">
              {runError && (selectedChart === "card" || isSeriesChart || isRowsChart) && (
                <div className="mb-4 w-full max-w-md">
                  <CAlert variant="error" message={runError} />
                </div>
              )}
              {!selectedChart ? (
                <div className="flex flex-col items-center text-center">
                  <MdDashboard size={32} style={{ color: "var(--border)" }} />
                  <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
                    Preview appears here once you pick a chart type
                  </p>
                </div>
              ) : selectedChart === "card" ? (
                <div
                  className="flex h-64 w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-sm"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <div className="h-full min-h-0 p-3">
                    <CardChart
                      title={{
                        value: chartConfig.title || widgetTitle,
                        valueFontSize: Number(chartConfig.titleFontSize) || undefined,
                        valueFontColor: chartConfig.titleFontColor || undefined,
                      }}
                      value={{
                        value: displayValue ?? 0,
                        valueFontSize: Number(chartConfig.valueFontSize) || undefined,
                        valueFontColor: chartConfig.valueFontColor || undefined,
                      }}
                      target={
                        hasTarget && displayTarget !== undefined
                          ? { value: displayTarget }
                          : undefined
                      }
                      targetBarColor={hasTarget ? chartConfig.targetBarColor : undefined}
                      valueFormat={(chartConfig.valueFormat as "currency" | "percentage" | "number" | "decimal") || "currency"}
                    />
                  </div>
                </div>
              ) : selectedChart === "line" ? (
                <div
                  className="flex h-64 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-sm"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <div className="h-full min-h-0">
                    <LineChart
                      title={{
                        value: chartConfig.title || widgetTitle,
                        valueFontSize: Number(chartConfig.titleFontSize) || undefined,
                        valueFontColor: chartConfig.titleFontColor || undefined,
                      }}
                      xAxis={chartConfig.xAxis}
                      xAxisColor={chartConfig.xAxisColor}
                      yAxis={chartConfig.yAxis}
                      yAxisColor={chartConfig.yAxisColor}
                      legend={chartConfig.legend}
                      lineType={chartConfig.lineType}
                      format={chartConfig.format}
                      yAxisFormat={chartConfig.yAxisFormat}
                      showDataPoints={chartConfig.showDataPoints}
                      xAxisIsDateTime={isXAxisDateTime}
                      data={previewRows ?? []}
                    />
                  </div>
                </div>
              ) : selectedChart === "bar" ? (
                <div
                  className="flex h-80 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-sm"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <div className="h-full min-h-0 p-3">
                    <BarChart
                      title={{
                        value: chartConfig.title || widgetTitle,
                        valueFontSize: Number(chartConfig.titleFontSize) || undefined,
                        valueFontColor: chartConfig.titleFontColor || undefined,
                      }}
                      xAxis={chartConfig.xAxis}
                      xAxisColor={chartConfig.xAxisColor}
                      yAxis={chartConfig.yAxis}
                      yAxisColor={chartConfig.yAxisColor}
                      legend={chartConfig.legend}
                      barOrientation={chartConfig.barOrientation}
                      stacked={chartConfig.stacked}
                      data={previewRows ?? []}
                    />
                  </div>
                </div>
              ) : selectedChart === "pie" ? (
                <div
                  className="flex h-80 w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-sm"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <div className="h-full min-h-0 p-3">
                    <PieChart
                      title={{
                        value: chartConfig.title || widgetTitle,
                        valueFontSize: Number(chartConfig.titleFontSize) || undefined,
                        valueFontColor: chartConfig.titleFontColor || undefined,
                      }}
                      category={chartConfig.category}
                      value={chartConfig.value}
                      sliceColor={chartConfig.sliceColor}
                      legend={chartConfig.legend}
                      radius={chartConfig.radius}
                      showValue={chartConfig.showValue}
                      showPercentage={chartConfig.showPercentage}
                      valuePosition={chartConfig.valuePosition}
                      data={previewRows ?? []}
                    />
                  </div>
                </div>
              ) : selectedChart === "table" ? (
                <div
                  className="flex h-96 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-sm"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <TableChart
                    title={{
                      value: chartConfig.title || widgetTitle,
                      valueFontSize: Number(chartConfig.titleFontSize) || undefined,
                      valueFontColor: chartConfig.titleFontColor || undefined,
                    }}
                    columns={chartConfig.columns}
                    pageSize={chartConfig.pageSize}
                    striped={chartConfig.striped}
                    showIndex={chartConfig.showIndex}
                    data={previewRows ?? []}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <FaChartBar size={32} style={{ color: "var(--border)" }} />
                  <p className="mt-3 text-sm font-medium" style={{ color: "var(--text-h)" }}>
                    Chart preview
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text)" }}>
                    Pick a chart type to see a preview.
                  </p>
                </div>
              )}

              {selected && selectedChart && (
                <div
                  className="mt-6 w-full max-w-md rounded-xl border px-3 py-2"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                    Data source
                  </p>
                  <p className="mt-1 truncate text-xs font-medium" style={{ color: "var(--text-h)" }}>
                    {selected.name}
                  </p>
                  <p className="truncate text-[10px]" style={{ color: "var(--text)" }}>
                    {selected.semantic_model.package.name} · {selected.semantic_model.name} · {selected.source}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </CDialog>
  );
}
