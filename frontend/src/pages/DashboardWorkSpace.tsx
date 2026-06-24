import { useCallback, useMemo, useRef, useState } from "react";
import { Responsive, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { MdDashboard, MdDragIndicator,MdClose , MdEdit } from "react-icons/md";
import { FaPlus, FaSave } from "react-icons/fa";
import { IoBarChartSharp } from "react-icons/io5";
import CButton from "../components/CButton";
import CardChart from "../components/charts/CardChart";
import WidgetEditDialog from "../components/WidgetEditDialog";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/dashboard-workspace.css";
import React from "react";

interface WidgetMeta {
  title: string;
  subtitle: string;
}


const INITIAL_ITEMS: LayoutItem[] = [
  { i: "widget-a", x: 0, y: 0, w: 8, h: 8, minW: 2, minH: 2 },
  { i: "widget-b", x: 8, y: 0, w: 8, h: 8, minW: 2, minH: 2 },
  { i: "widget-c", x: 16, y: 0, w: 8, h: 8, minW: 2, minH: 2 },
];

const INITIAL_META: Record<string, WidgetMeta> = {
  "widget-a": { title: "Revenue Overview", subtitle: "Monthly trend" },
  "widget-b": { title: "Active Users", subtitle: "Last 7 days" },
  "widget-c": { title: "Top Products", subtitle: "By sales volume" },
};

const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const cols = { lg: 32, md: 24, sm: 16, xs: 8, xxs: 4 };
const GRID_ROWS = 24;
const GRID_MARGIN: [number, number] = [6, 6];

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

function DashboardWidget(props: { meta: WidgetMeta; chart?: React.ReactNode }) {
  const { meta, chart } = props;
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div
        className="flex h-full flex-col overflow-hidden rounded-2xl"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >

      <div
        className="handle flex w-full cursor-grab items-center gap-2 px-3 py-0.5 active:cursor-grabbing"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          minHeight: 28,
          height: 28,
          maxHeight: 28,
        }}
      >
        <MdDragIndicator size={16} style={{ color: "var(--text)", flexShrink: 0 }} />
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="flex items-center justify-center rounded-lg p-0.5 transition hover:bg-black/5"
            style={{
              border: "none",
              background: "none",
              color: "var(--text)",
              boxShadow: "none",
              minWidth: 20,
              height: 20,
            }}
            aria-label="Edit widget"
            onClick={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <MdEdit size={14} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-lg p-0.5 transition hover:bg-red-100"
            style={{
              border: "none",
              background: "none",
              color: "var(--error-fg)",
              boxShadow: "none",
              minWidth: 20,
              height: 20,
            }}
            aria-label="Remove widget"
          >
            <MdClose size={14} style={{ color: "var(--error-fg)" }} />
          </button>
        </div>
      </div>

      {!chart && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
          >
            <IoBarChartSharp size={18} />
          </span>
          <p className="text-xs font-medium cursor-pointer" style={{ color: "var(--text-h)" }}>
            Create chart
          </p>
          <p className="text-[10px]" style={{ color: "var(--text)" }}>
            Drag to reposition · resize from the corner
          </p>
        </div>
      )}

      {chart && (
        <div className="flex min-h-0 flex-1 flex-col">
          {chart}
        </div>
      )}
      </div>

      <WidgetEditDialog
        isOpen={editOpen}
        widgetTitle={meta.title}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}

export default function DashboardWorkSpace() {
  const widgetCount = useRef(INITIAL_ITEMS.length);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => buildLayouts(INITIAL_ITEMS));
  const [widgetMeta, setWidgetMeta] = useState<Record<string, WidgetMeta>>(INITIAL_META);
  const { width, containerRef, mounted } = useContainerWidth();

  const { rowHeight, canvasHeight, cellSize } = useMemo(
    () => getSquareGridMetrics(width),
    [width],
  );

  const layoutItems = (layouts.lg ?? []) as LayoutItem[];

  const handleLayoutChange = useCallback((_layout: Layout, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts);
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

    const nextItems = [...current, newItem];
    setLayouts(buildLayouts(nextItems));
    setWidgetMeta((prev) => ({
      ...prev,
      [id]: { title: `Widget ${widgetCount.current}`, subtitle: "New chart" },
    }));
  }, [layouts.lg]);

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
            className="dashboard-workspace-grid relative rounded-2xl"
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
              dragConfig={{ enabled: true, handle: ".handle" }}
              resizeConfig={{ enabled: true }}
              compactor={verticalCompactor}
              onLayoutChange={handleLayoutChange}
              style={{ minHeight: canvasHeight }}
            >
              {layoutItems.map((item) => (
                <div key={item.i}>
                  <DashboardWidget
                    meta={widgetMeta[item.i] ?? { title: "Widget", subtitle: "" }}
                    chart={
                      <CardChart
                        title={widgetMeta[item.i]?.title}
                        value={{ value: 128400 }}
                        target={{ label: "Target", value: 150000 }}
                        compare={{ label: "Compare", value: 12.4 }}
                      />
                    }
                  />
                </div>
              ))}
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
