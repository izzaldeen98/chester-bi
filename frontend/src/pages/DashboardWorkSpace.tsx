import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Responsive, verticalCompactor } from "react-grid-layout";
import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { MdDashboard } from "react-icons/md";
import { FaPlus, FaSave, FaEye } from "react-icons/fa";
import { IoBarChartSharp } from "react-icons/io5";
import CButton from "../components/CButton";
import CWidget from "../components/CWidget/CWidget";
import DashboardWidgetChart from "../components/DashboardWidgetChart";
import type { WidgetChartConfig, WidgetSaveResult } from "../components/WidgetEditDialog";
import { type FilterRule, type AvailableChart } from "../components/FilterEditDialog";
import DashboardFilterWidget from "../components/DashboardFilterWidget";
import ComponentPromptDialog from "../components/ComponentPromptDialog";
import {
  getDashboardConfig,
  saveDashboardConfig,
  type DashboardElement,
} from "../lib/Api";
import { toSavedWidgetMeta } from "../lib/dashboardWidgetData";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/dashboard-workspace.css";
interface WidgetMeta {
  title: string;
  query?: string;
  datasetId?: string;
  chartType?: WidgetChartConfig["chartType"];
  chartConfig?: Record<string, string>;
  previewValue?: number | null;
  previewRows?: Record<string, unknown>[] | null;
  filterRule?: FilterRule;
}
function toWidgetConfig(meta: WidgetMeta): WidgetChartConfig | undefined {
  if (!meta.datasetId && !meta.chartConfig) return undefined;
  return {
    datasetId: meta.datasetId,
    datasetName: meta.query,
    chartType: meta.chartType,
    chartConfig: meta.chartConfig,
    previewValue: meta.previewValue ?? null,
    previewRows: meta.previewRows ?? null,
  };
}

// Fixed breakpoint AND fixed pixel cell size: widget x/y/w/h are saved once and must
// render pixel-for-pixel the same everywhere. Sizing columns off each page's own
// (possibly different) window width made the grid look denser/sparser between the
// workspace and the view tab even at the same column count — so the canvas is a
// constant size and the container scrolls horizontally on narrower windows instead.
const GRID_COLS = 32;
const CELL_SIZE = 37;
const breakpoints = { lg: 0 };
const cols = { lg: GRID_COLS };
const DEFAULT_GRID_ROWS = 36;
const MIN_GRID_ROWS = 8;
const MAX_GRID_ROWS = 200;
const GRID_MARGIN: [number, number] = [8, 8];

function getSquareGridMetrics(gridRows: number) {
  const [mx, my] = GRID_MARGIN;
  const canvasWidth = GRID_COLS * CELL_SIZE + mx * (GRID_COLS - 1);
  const canvasHeight = gridRows * CELL_SIZE + my * (gridRows - 1);

  return { rowHeight: CELL_SIZE, canvasWidth, canvasHeight, cellSize: CELL_SIZE };
}

function buildLayouts(items: LayoutItem[]): ResponsiveLayouts {
  // Each breakpoint needs its OWN array so RGL can't mutate them across breakpoints
  return {
    lg: [...items],
    md: [...items],
    sm: [...items],
    xs: [...items],
    xxs: [...items],
  };
}

function getNextY(items: LayoutItem[]) {
  return items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

export default function DashboardWorkSpace() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const dashboardNameRef = useRef("Dashboard Workspace");

  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => buildLayouts([]));
  const [widgetMeta, setWidgetMeta] = useState<Record<string, WidgetMeta>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, FilterRule>>({});
  // activeFilters drives slice-and-dice: runtime values of each filter widget
  // passed to DashboardWidgetChart so queries re-execute when filters change
  const activeFilterList = Object.values(activeFilters);
  const [gridRows, setGridRows] = useState(DEFAULT_GRID_ROWS);
  const [gridRowsInput, setGridRowsInput] = useState(String(DEFAULT_GRID_ROWS));
  const [bgColor, setBgColor] = useState("");
  // Element id whose AI prompt dialog is open (null = closed)
  const [promptingId, setPromptingId] = useState<string | null>(null);

  const { rowHeight, canvasWidth, canvasHeight, cellSize } = useMemo(
    () => getSquareGridMetrics(gridRows),
    [gridRows],
  );

  const layoutItems = (layouts.lg ?? []) as LayoutItem[];

  useEffect(() => {
    if (!dashboardId) return;

    getDashboardConfig(dashboardId)
      .then((config) => {
        dashboardNameRef.current = config.name || "Dashboard Workspace";

        const loadedRows = config.gridRows ?? DEFAULT_GRID_ROWS;
        setGridRows(loadedRows);
        setGridRowsInput(String(loadedRows));
        setBgColor(config.backgroundColor ?? "");

        const items: LayoutItem[] = [];
        const meta: Record<string, WidgetMeta> = {};

        for (const el of config.elements ?? []) {
          items.push({
            i: el.id,
            x: el.layout.x,
            y: el.layout.y,
            w: el.layout.w,
            h: el.layout.h,
            minW: el.layout.minW ?? 2,
            minH: el.layout.minH ?? 2,
          });
          meta[el.id] = {
            title: el.meta.title,
            query: el.meta.query,
            datasetId: el.meta.datasetId,
            chartType: el.meta.chartType as WidgetChartConfig["chartType"],
            chartConfig: el.meta.chartConfig,
            filterRule: el.meta.filterRule as FilterRule | undefined,
          };
        }

        setLayouts(buildLayouts(items));
        setWidgetMeta(meta);

        // Restore active filter runtime values from saved meta
        const initFilters: Record<string, FilterRule> = {};
        for (const [id, m] of Object.entries(meta)) {
          if (m.filterRule) initFilters[id] = m.filterRule;
        }
        setActiveFilters(initFilters);
      })
      .catch(() => {
        // Keep empty workspace on load failure; save still requires dashboardId
      });
  }, [dashboardId]);

  const handleLayoutChange = useCallback((_layout: any, allLayouts: any) => {
    setLayouts(allLayouts);
  }, []);

  const handleDeleteWidget = useCallback((id: string) => {
    setLayouts((prevLayouts) => {
      const newLayouts: ResponsiveLayouts = {};
      for (const [breakpoint, items] of Object.entries(prevLayouts)) {
        newLayouts[breakpoint] = (items ?? []).filter((widget) => widget.i !== id);
      }
      return newLayouts;
    });
    setWidgetMeta((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveFilters((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleFilterChange = useCallback((id: string, rule: FilterRule) => {
    setActiveFilters((prev) => ({ ...prev, [id]: rule }));
    setWidgetMeta((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        title: rule.label || `${rule.operator} filter`,
        filterRule: rule,
      },
    }));
  }, []);

  const addFilter = useCallback(() => {
    const id = `filter-${crypto.randomUUID()}`;

    const placeholder: FilterRule = {
      label: "New Filter",
      kind: "text",
      operator: "equals",
      value: "",
      mappings: [],
      targetWidgetIds: [],
    };

    setLayouts((prev) => {
      const current = (prev.lg ?? []) as LayoutItem[];
      const y = getNextY(current);
      return buildLayouts([...current, { i: id, x: 0, y, w: 10, h: 2, minW: 4, minH: 1 }]);
    });
    setWidgetMeta((prev) => ({
      ...prev,
      [id]: { title: placeholder.label, filterRule: placeholder },
    }));
    setActiveFilters((prev) => ({ ...prev, [id]: placeholder }));
  }, []);


  const addWidget = useCallback(() => {
    const id = `widget-${crypto.randomUUID()}`;

    setLayouts((prev) => {
      const current = (prev.lg ?? []) as LayoutItem[];
      const y = getNextY(current);
      return buildLayouts([...current, { i: id, x: 0, y, w: 8, h: 8, minW: 2, minH: 2 }]);
    });
    setWidgetMeta((prev) => ({ ...prev, [id]: { title: "New Chart" } }));
  }, []);

  const handleConfigChange = useCallback((widgetId: string, result: WidgetSaveResult) => {
    setWidgetMeta((prev) => ({
      ...prev,
      [widgetId]: {
        title: result.chartConfig.title || prev[widgetId]?.title || "Widget",
        query: result.dataset.name,
        datasetId: result.dataset.id,
        chartType: result.chartType,
        chartConfig: result.chartConfig,
        previewValue: result.previewValue,
        previewRows: result.previewRows,
      },
    }));
  }, []);

  const handleAgentEdit = useCallback((el: DashboardElement) => {
    setWidgetMeta((prev) => ({
      ...prev,
      [el.id]: {
        title: el.meta.title,
        query: el.meta.query,
        datasetId: el.meta.datasetId,
        chartType: el.meta.chartType as WidgetChartConfig["chartType"],
        chartConfig: el.meta.chartConfig,
        filterRule: el.meta.filterRule as FilterRule | undefined,
      },
    }));
    setLayouts((prev) => {
      const current = (prev.lg ?? []) as LayoutItem[];
      return buildLayouts(
        current.map((item) =>
          item.i === el.id
            ? { ...item, x: el.layout.x, y: el.layout.y, w: el.layout.w, h: el.layout.h }
            : item,
        ),
      );
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!dashboardId) return;

    const elements: DashboardElement[] = layoutItems.map((item) => ({
      id: item.i,
      layout: {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW ?? 2,
        minH: item.minH ?? 2,
      },
      meta: toSavedWidgetMeta(widgetMeta[item.i] ?? { title: "Widget" }),
    }));

    await saveDashboardConfig(dashboardId, {
      version: "1.0.0",
      name: dashboardNameRef.current,
      gridRows,
      backgroundColor: bgColor || undefined,
      elements,
    });
  }, [dashboardId, layoutItems, widgetMeta, gridRows, bgColor]);

  const openPrompt = useCallback(async (id: string) => {
    // The agent edits whatever is in the saved config file, so flush local
    // layout/config changes before asking it to change anything.
    await handleSave();
    setPromptingId(id);
  }, [handleSave]);

  const handlePreview = useCallback(async () => {
    if (!dashboardId) return;
    await handleSave();
    window.open(`/view/${dashboardId}`, "_blank", "noopener,noreferrer");
  }, [dashboardId, handleSave]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}
      >
        <MdDashboard size={18} style={{ color: "var(--accent)" }} />
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-h)" }}>
            Dashboard Workspace
          </p>
          <p className="text-[11px]" style={{ color: "var(--text)" }}>
            {layoutItems.length} widget{layoutItems.length !== 1 ? "s" : ""} · drag handles to move
          </p>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: "var(--text)" }}>
            Rows
          </label>
          <input
            type="number"
            min={MIN_GRID_ROWS}
            max={MAX_GRID_ROWS}
            value={gridRowsInput}
            onChange={(e) => setGridRowsInput(e.target.value)}
            onBlur={() => {
              const n = Math.min(MAX_GRID_ROWS, Math.max(MIN_GRID_ROWS, parseInt(gridRowsInput, 10) || DEFAULT_GRID_ROWS));
              setGridRows(n);
              setGridRowsInput(String(n));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded-lg border px-2 py-1 text-xs tabular-nums outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-h)" }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium" style={{ color: "var(--text)" }}>
            Background
          </label>
          <input
            type="color"
            value={bgColor || "#0b0d12"}
            onChange={(e) => setBgColor(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border p-0"
            style={{ borderColor: "var(--border)" }}
          />
          {bgColor && (
            <button
              type="button"
              onClick={() => setBgColor("")}
              className="text-[11px] underline"
              style={{ color: "var(--text)" }}
            >
              reset
            </button>
          )}
        </div>

        <div className="h-4 w-px" style={{ background: "var(--border)" }} />

        <CButton variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={addWidget}>
          <FaPlus size={11} /> Add Chart
        </CButton>
        <CButton variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={addFilter}>
          <FaPlus size={11} /> Add Filter
        </CButton>
        <CButton variant="outline" className="!px-3 !py-1.5 !text-xs" disabled={!dashboardId} onClick={handlePreview}>
          <FaEye size={11} /> Preview
        </CButton>
        <CButton variant="primary" className="!px-3 !py-1.5 !text-xs" disabled={!dashboardId} onClick={handleSave}>
          <FaSave size={11} /> Save Layout
        </CButton>
      </header>

      <div
        className="dashboard-workspace flex-1 overflow-auto p-2"
        style={{ background: bgColor || "var(--bg)" }}
      >
        {layoutItems.length > 0 && (
          <div
            className="dashboard-workspace-grid relative"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              minHeight: canvasHeight,
              ["--cell-size" as string]: `${cellSize + GRID_MARGIN[0]}px`,
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
            }}
          >
            <Responsive
              layouts={layouts}
              breakpoints={breakpoints}
              cols={cols}
              width={canvasWidth}
              rowHeight={rowHeight}
              margin={GRID_MARGIN}
              containerPadding={[0, 0] as const}
              maxRows={gridRows}
              autoSize={false}
              dragConfig={{ enabled: true, handle: ".widget-drag-handle" }}
              resizeConfig={{ enabled: true }}
              compactor={verticalCompactor}
              onLayoutChange={handleLayoutChange}
              style={{ minHeight: canvasHeight }}
            >
              {layoutItems.map((item) => {
                const meta = widgetMeta[item.i] ?? { title: "Widget" };
                const isFilter = Boolean(meta.filterRule);

                // Charts available for filter targeting (non-filter widgets with a query)
                const availableCharts: AvailableChart[] = layoutItems
                  .filter((li) => !widgetMeta[li.i]?.filterRule)
                  .map((li) => ({ id: li.i, title: widgetMeta[li.i]?.title ?? li.i }));

                return (
                  <div key={item.i} className="h-full">
                    {isFilter ? (
                      <DashboardFilterWidget
                        rule={meta.filterRule!}
                        availableCharts={availableCharts}
                        onChange={(rule) => handleFilterChange(item.i, rule)}
                        onDelete={() => handleDeleteWidget(item.i)}
                      />
                    ) : (
                      <CWidget
                        id={item.i}
                        title={meta.title}
                        query={meta.query}
                        config={toWidgetConfig(meta)}
                        chart={
                          <DashboardWidgetChart
                            widgetId={item.i}
                            meta={meta}
                            preferCachedPreview
                            activeFilters={activeFilterList}
                          />
                        }
                        onConfigChange={(result) => handleConfigChange(item.i, result)}
                        onDelete={() => handleDeleteWidget(item.i)}
                        onPrompt={dashboardId ? () => openPrompt(item.i) : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </Responsive>
          </div>
        )}

        {promptingId && (
          <ComponentPromptDialog
            isOpen
            dashboardId={dashboardId}
            elementId={promptingId}
            elementTitle={widgetMeta[promptingId]?.title ?? promptingId}
            onClose={() => setPromptingId(null)}
            onApplied={handleAgentEdit}
          />
        )}

        {layoutItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <IoBarChartSharp size={36} style={{ color: "var(--border)" }} />
            <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
              No widgets yet — click Add Widget to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
