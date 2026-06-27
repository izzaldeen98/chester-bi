import { useCallback, useMemo, useRef, useState } from "react";
import { Responsive, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { MdDashboard } from "react-icons/md";
import { FaPlus, FaSave } from "react-icons/fa";
import { IoBarChartSharp } from "react-icons/io5";
import CButton from "../components/CButton";
import CWidget from "../components/CWidget/CWidget";
import CardChart from "../components/charts/CardChart/CardChart";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import type { WidgetChartConfig, WidgetSaveResult } from "../components/WidgetEditDialog";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/dashboard-workspace.css";

interface WidgetMeta {
  title: string;
  query?: string;
  queryId?: string;
  chartType?: WidgetChartConfig["chartType"];
  chartConfig?: Record<string, string>;
  previewValue?: number | null;
  previewRows?: Record<string, unknown>[] | null;
}

function isConfigTruthy(value: string | undefined) {
  return value === "true" || value === "1" || value === "on";
}

function toWidgetConfig(meta: WidgetMeta): WidgetChartConfig | undefined {
  if (!meta.queryId && !meta.chartType && !meta.chartConfig) return undefined;
  return {
    queryId: meta.queryId,
    queryName: meta.query,
    chartType: meta.chartType,
    chartConfig: meta.chartConfig,
    previewValue: meta.previewValue,
    previewRows: meta.previewRows,
  };
}

function renderWidgetChart(meta: WidgetMeta) {
  if (!meta.queryId || !meta.chartConfig) return undefined;

  const cfg = meta.chartConfig;

  if (meta.chartType === "card") {
    const hasTarget = isConfigTruthy(cfg.hasTarget);
    const displayValue = meta.previewValue ?? (cfg.value ? Number(cfg.value) : 0);

    return (
      <CardChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        value={{
          value: Number.isFinite(displayValue) ? displayValue : 0,
          valueFontSize: Number(cfg.valueFontSize) || undefined,
          valueFontColor: cfg.valueFontColor || undefined,
        }}
        target={hasTarget ? { value: Number(cfg.target) || 0 } : undefined}
        targetBarColor={hasTarget ? cfg.targetBarColor : undefined}
        valueFormat={(cfg.valueFormat as "currency" | "percentage" | "number" | "decimal") || "currency"}
      />
    );
  }

  if (meta.chartType === "line") {
    return (
      <LineChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        xAxis={cfg.xAxis}
        xAxisColor={cfg.xAxisColor}
        yAxis={cfg.yAxis}
        yAxisColor={cfg.yAxisColor}
        legend={cfg.legend}
        data={meta.previewRows ?? []}
      />
    );
  }

  if (meta.chartType === "bar") {
    return (
      <BarChart
        title={{
          value: cfg.title || meta.title,
          valueFontSize: Number(cfg.titleFontSize) || undefined,
          valueFontColor: cfg.titleFontColor || undefined,
        }}
        xAxis={cfg.xAxis}
        xAxisColor={cfg.xAxisColor}
        yAxis={cfg.yAxis}
        yAxisColor={cfg.yAxisColor}
        legend={cfg.legend}
        barOrientation={cfg.barOrientation}
        stacked={cfg.stacked}
        data={meta.previewRows ?? []}
      />
    );
  }

  return undefined;
}

const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const cols = { lg: 32, md: 24, sm: 16, xs: 8, xxs: 4 };
const GRID_ROWS = 24;
const GRID_MARGIN: [number, number] = [8, 8];

function getActiveCols(containerWidth: number) {
  if (containerWidth >= breakpoints.lg) return cols.lg;
  if (containerWidth >= breakpoints.md) return cols.md;
  if (containerWidth >= breakpoints.sm) return cols.sm;
  if (containerWidth >= breakpoints.xs) return cols.xs;
  return cols.xxs;
}

function getSquareGridMetrics(containerWidth: number) {
  if (containerWidth <= 0) {
    return { rowHeight: 48, canvasHeight: GRID_ROWS * 48, cellSize: 48, activeCols: cols.lg };
  }

  const activeCols = getActiveCols(containerWidth);
  const [mx, my] = GRID_MARGIN;
  const cellSize = Math.floor((containerWidth - mx * (activeCols - 1)) / activeCols);
  const rowHeight = cellSize;
  const canvasHeight = GRID_ROWS * cellSize + my * (GRID_ROWS - 1);

  return { rowHeight, canvasHeight, cellSize, activeCols };
}

function buildLayouts(items: LayoutItem[]): ResponsiveLayouts {
  return { lg: items, md: items, sm: items, xs: items, xxs: items };
}

function getNextY(items: LayoutItem[]) {
  return items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

export default function DashboardWorkSpace() {
  const widgetCount = useRef(0);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => buildLayouts([]));
  const [widgetMeta, setWidgetMeta] = useState<Record<string, WidgetMeta>>({});
  const { width, containerRef, mounted } = useContainerWidth();

  const { rowHeight, canvasHeight, cellSize } = useMemo(
    () => getSquareGridMetrics(width),
    [width],
  );

  const layoutItems = (layouts.lg ?? []) as LayoutItem[];

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
  }, []);

  const addWidget = useCallback(() => {
    const current = (layouts.lg ?? []) as LayoutItem[];
    widgetCount.current += 1;
    const id = `widget-${widgetCount.current}`;
    const y = getNextY(current);

    const newItem: LayoutItem = {
      i: id,
      x: 0,
      y,
      w: 8,
      h: 8,
      minW: 2,
      minH: 2,
    };

    setLayouts(buildLayouts([...current, newItem]));
    setWidgetMeta((prev) => ({
      ...prev,
      [id]: { title: `Widget ${widgetCount.current}` },
    }));
  }, [layouts.lg]);

  const handleConfigChange = useCallback((widgetId: string, result: WidgetSaveResult) => {
    setWidgetMeta((prev) => ({
      ...prev,
      [widgetId]: {
        title: result.chartConfig.title || prev[widgetId]?.title || "Widget",
        query: result.query.name,
        queryId: result.query.id,
        chartType: result.chartType,
        chartConfig: result.chartConfig,
        previewValue: result.previewValue,
        previewRows: result.previewRows,
      },
    }));
  }, []);

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

        <CButton variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={addWidget}>
          <FaPlus size={11} /> Add Widget
        </CButton>
        <CButton variant="primary" className="!px-3 !py-1.5 !text-xs" disabled>
          <FaSave size={11} /> Save Layout
        </CButton>
      </header>

      <div
        ref={containerRef}
        className="dashboard-workspace flex-1 overflow-auto p-2"
        style={{ background: "var(--bg)" }}
      >
        {mounted && layoutItems.length > 0 && (
          <div
            className="dashboard-workspace-grid relative"
            style={{
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
              width={width}
              rowHeight={rowHeight}
              margin={GRID_MARGIN}
              containerPadding={[0, 0] as const}
              maxRows={GRID_ROWS}
              autoSize={false}
              dragConfig={{ enabled: true, handle: ".widget-drag-handle" }}
              resizeConfig={{ enabled: true }}
              compactor={verticalCompactor}
              onLayoutChange={handleLayoutChange}
              style={{ minHeight: canvasHeight }}
            >
              {layoutItems.map((item) => {
                const meta = widgetMeta[item.i] ?? { title: "Widget" };
                return (
                  <div key={item.i}>
                    <CWidget
                      id={item.i}
                      title={meta.title}
                      query={meta.query}
                      config={toWidgetConfig(meta)}
                      chart={renderWidgetChart(meta)}
                      onConfigChange={(result) => handleConfigChange(item.i, result)}
                      onDelete={() => handleDeleteWidget(item.i)}
                    />
                  </div>
                );
              })}
            </Responsive>
          </div>
        )}

        {mounted && layoutItems.length === 0 && (
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
