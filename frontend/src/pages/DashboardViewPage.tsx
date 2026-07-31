import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Responsive } from "react-grid-layout";
import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { MdDashboard, MdArrowBack, MdEdit } from "react-icons/md";
import { FaFilePdf } from "react-icons/fa";
import CWidget from "../components/CWidget/CWidget";
import CSpinner from "../components/CSpinner";
import CAlert from "../components/CAlert";
import CButton from "../components/CButton";
import DashboardWidgetChart from "../components/DashboardWidgetChart";
import DashboardFilterWidget from "../components/DashboardFilterWidget";
import { getDashboardConfig, type DashboardElementMeta } from "../lib/Api";
import type { FilterRule } from "../components/FilterEditDialog";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../styles/dashboard-workspace.css";

// Must match DashboardWorkSpace.tsx exactly: widget x/y/w/h are saved once and must
// render pixel-for-pixel the same everywhere. Sizing columns off each page's own
// (possibly different) window width made the grid look denser/sparser between the
// workspace and this view tab even at the same column count — so the canvas is a
// constant size and the container scrolls horizontally on narrower windows instead.
const GRID_COLS = 32;
const CELL_SIZE = 37;
const breakpoints = { lg: 0 };
const cols = { lg: GRID_COLS };
const DEFAULT_GRID_ROWS = 36;
const GRID_MARGIN: [number, number] = [8, 8];

function getSquareGridMetrics(gridRows: number) {
  const [mx, my] = GRID_MARGIN;
  const canvasWidth = GRID_COLS * CELL_SIZE + mx * (GRID_COLS - 1);
  const canvasHeight = gridRows * CELL_SIZE + my * (gridRows - 1);
  return { rowHeight: CELL_SIZE, canvasWidth, canvasHeight, cellSize: CELL_SIZE };
}

export default function DashboardViewPage() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardName, setDashboardName] = useState("Dashboard");
  const [gridRows, setGridRows] = useState(DEFAULT_GRID_ROWS);
  const [bgColor, setBgColor] = useState("");
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>([]);
  const [metaMap, setMetaMap] = useState<Record<string, DashboardElementMeta>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, FilterRule>>({});

  const { rowHeight, canvasWidth, canvasHeight, cellSize } = useMemo(() => getSquareGridMetrics(gridRows), [gridRows]);

  const layouts: ResponsiveLayouts = useMemo(
    () => ({ lg: layoutItems, md: layoutItems, sm: layoutItems, xs: layoutItems, xxs: layoutItems }),
    [layoutItems],
  );

  const loadDashboard = useCallback(() => {
    if (!dashboardId) return;

    setLoading(true);
    setError("");

    getDashboardConfig(dashboardId)
      .then((config) => {
        setDashboardName(config.name || "Dashboard");
        setGridRows(config.gridRows ?? DEFAULT_GRID_ROWS);
        setBgColor(config.backgroundColor ?? "");

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

        // Seed runtime filter values from saved config
        const initFilters: Record<string, FilterRule> = {};
        for (const el of config.elements ?? []) {
          if (el.meta.filterRule) {
            initFilters[el.id] = el.meta.filterRule as unknown as FilterRule;
          }
        }
        setActiveFilters(initFilters);
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, [dashboardId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3" style={{ background: "var(--bg)" }}>
        <CSpinner size={28} />
        <p className="text-xs" style={{ color: "var(--text)" }}>
          Loading dashboard…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 p-8" style={{ background: "var(--bg)" }}>
        <CAlert variant="error" message={error} className="max-w-md" />
        <div className="flex items-center gap-2">
          <CButton variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={() => navigate(-1)}>
            <MdArrowBack size={13} /> Back
          </CButton>
          <CButton variant="primary" className="!px-3 !py-1.5 !text-xs" onClick={loadDashboard}>
            Try again
          </CButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden animate-[fadeIn_0.15s_ease-out]" style={{ background: "var(--bg)" }}>
      <header
        className="no-print flex shrink-0 items-center gap-3 px-4 py-2.5"
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
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-h)" }}>
            {dashboardName}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text)" }}>
            {layoutItems.length} widget{layoutItems.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--bg)]"
          style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
        >
          <FaFilePdf size={13} /> Export PDF
        </button>

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
        className="dashboard-workspace flex-1 overflow-auto p-2 dashboard-view-mode"
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
              dragConfig={{ enabled: false }}
              resizeConfig={{ enabled: false }}
              style={{ minHeight: canvasHeight }}
            >
              {layoutItems.map((item) => {
                const meta = metaMap[item.i] ?? { title: "Widget" };
                const filterRule = (meta.filterRule ?? activeFilters[item.i]) as FilterRule | undefined;
                const activeFilterList = Object.values(activeFilters);

                return (
                  <div key={item.i} className="h-full">
                    {filterRule ? (
                      <DashboardFilterWidget
                        rule={activeFilters[item.i] ?? filterRule}
                        readOnly={false}
                        onChange={(rule) =>
                          setActiveFilters((prev) => ({ ...prev, [item.i]: rule }))
                        }
                      />
                    ) : (
                      <CWidget
                        id={item.i}
                        title={meta.title}
                        chart={
                          <DashboardWidgetChart
                            widgetId={item.i}
                            meta={meta as any}
                            activeFilters={activeFilterList}
                          />
                        }
                        readOnly
                      />
                    )}
                  </div>
                );
              })}
            </Responsive>
          </div>
        )}

        {layoutItems.length === 0 && (
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
