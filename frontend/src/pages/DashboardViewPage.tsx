import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Responsive, useContainerWidth } from "react-grid-layout";
import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { MdDashboard, MdArrowBack, MdEdit } from "react-icons/md";
import CWidget from "../components/CWidget/CWidget";
import CSpinner from "../components/CSpinner";
import CAlert from "../components/CAlert";
import DashboardWidgetChart from "../components/DashboardWidgetChart";
import { getDashboardConfig, type DashboardElementMeta } from "../lib/Api";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/dashboard-workspace.css";

const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const cols = { lg: 32, md: 24, sm: 16, xs: 8, xxs: 4 };
const DEFAULT_GRID_ROWS = 24;
const GRID_MARGIN: [number, number] = [8, 8];

function getActiveCols(containerWidth: number) {
  if (containerWidth >= breakpoints.lg) return cols.lg;
  if (containerWidth >= breakpoints.md) return cols.md;
  if (containerWidth >= breakpoints.sm) return cols.sm;
  if (containerWidth >= breakpoints.xs) return cols.xs;
  return cols.xxs;
}

function getSquareGridMetrics(containerWidth: number, gridRows: number) {
  if (containerWidth <= 0) {
    return { rowHeight: 48, canvasHeight: gridRows * 48, cellSize: 48 };
  }
  const activeCols = getActiveCols(containerWidth);
  const [mx, my] = GRID_MARGIN;
  const cellSize = Math.floor((containerWidth - mx * (activeCols - 1)) / activeCols);
  const rowHeight = cellSize;
  const canvasHeight = gridRows * cellSize + my * (gridRows - 1);
  return { rowHeight, canvasHeight, cellSize };
}

export default function DashboardViewPage() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardName, setDashboardName] = useState("Dashboard");
  const [gridRows, setGridRows] = useState(DEFAULT_GRID_ROWS);
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>([]);
  const [metaMap, setMetaMap] = useState<Record<string, DashboardElementMeta>>({});

  const { width, containerRef, mounted } = useContainerWidth();
  const { rowHeight, canvasHeight, cellSize } = useMemo(() => getSquareGridMetrics(width, gridRows), [width, gridRows]);

  const layouts: ResponsiveLayouts = useMemo(
    () => ({ lg: layoutItems, md: layoutItems, sm: layoutItems, xs: layoutItems, xxs: layoutItems }),
    [layoutItems],
  );

  useEffect(() => {
    if (!dashboardId) return;

    setLoading(true);
    setError("");

    getDashboardConfig(dashboardId)
      .then((config) => {
        setDashboardName(config.name || "Dashboard");
        setGridRows(config.gridRows ?? DEFAULT_GRID_ROWS);

        const items: LayoutItem[] = [];
        const meta: Record<string, DashboardElementMeta> = {};

        for (const el of config.elements ?? []) {
          items.push({
            i: el.id,
            x: el.layout.x,
            y: el.layout.y,
            w: el.layout.w,
            h: el.layout.h,
            minW: el.layout.minW ?? 2,
            minH: el.layout.minH ?? 2,
            static: true,
          });
          meta[el.id] = el.meta;
        }

        setLayoutItems(items);
        setMetaMap(meta);
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, [dashboardId]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center" style={{ background: "var(--bg)" }}>
        <CSpinner size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 p-8" style={{ background: "var(--bg)" }}>
        <CAlert variant="error" message={error} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition hover:bg-[var(--bg)]"
          style={{ color: "var(--text)" }}
        >
          <MdArrowBack size={15} /> Back
        </button>

        <div className="h-4 w-px" style={{ background: "var(--border)" }} />

        <MdDashboard size={18} style={{ color: "var(--accent)" }} />
        <p className="text-sm font-bold" style={{ color: "var(--text-h)" }}>
          {dashboardName}
        </p>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => dashboardId && (window.location.href = `/workspace/${dashboardId}`)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--bg)]"
          style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
        >
          <MdEdit size={13} /> Edit Dashboard
        </button>
      </header>

      <div
        ref={containerRef}
        className="dashboard-workspace flex-1 overflow-auto p-2 dashboard-view-mode"
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
              maxRows={gridRows}
              autoSize={false}
              dragConfig={{ enabled: false }}
              resizeConfig={{ enabled: false }}
              style={{ minHeight: canvasHeight }}
            >
              {layoutItems.map((item) => {
                const meta = metaMap[item.i] ?? { title: "Widget" };
                return (
                  <div key={item.i}>
                    <CWidget
                      id={item.i}
                      title={meta.title}
                      chart={<DashboardWidgetChart meta={meta} />}
                      readOnly
                    />
                  </div>
                );
              })}
            </Responsive>
          </div>
        )}

        {mounted && layoutItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MdDashboard size={36} style={{ color: "var(--border)" }} />
            <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
              This dashboard has no widgets yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
