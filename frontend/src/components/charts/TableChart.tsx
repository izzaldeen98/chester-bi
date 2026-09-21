import { useMemo, useState } from "react";
import { MdArrowUpward, MdArrowDownward, MdUnfoldMore } from "react-icons/md";
import { getRowFieldValue } from "../../lib/queryResult";

interface TitleField {
  value: string;
  valueFontSize?: number;
  valueFontColor?: string;
}

export interface TableChartProps {
  title?: TitleField;
  columns?: string;
  columnAliases?: string;
  pageSize?: string | number;
  striped?: string | boolean;
  showIndex?: string | boolean;
  data?: Record<string, unknown>[];
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((p) => p.trim()).filter(Boolean);
}

function isTruthy(value: string | boolean | undefined) {
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1" || value === "on";
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

type SortDir = "asc" | "desc" | null;

export default function TableChart({
  title,
  columns,
  columnAliases,
  pageSize = "10",
  striped,
  showIndex,
  data = [],
}: TableChartProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);

  const cols = useMemo(() => {
    const defined = parseList(columns);
    if (defined.length > 0) return defined;
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [columns, data]);

  const aliases = useMemo(() => {
    const list = parseList(columnAliases);
    const map: Record<string, string> = {};
    cols.forEach((col, i) => {
      map[col] = list[i] || col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    });
    return map;
  }, [cols, columnAliases]);

  const rowsPerPage = Math.max(1, Number(pageSize) || 10);
  const isStriped = isTruthy(striped);
  const doShowIndex = isTruthy(showIndex);

  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = getRowFieldValue(a, sortCol);
      const bv = getRowFieldValue(b, sortCol);
      const an = Number.isFinite(Number(av)) ? Number(av) : av;
      const bn = Number.isFinite(Number(bv)) ? Number(bv) : bv;
      if (an == null && bn == null) return 0;
      if (an == null) return 1;
      if (bn == null) return -1;
      if (typeof an === "number" && typeof bn === "number") {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc"
        ? String(an).localeCompare(String(bn))
        : String(bn).localeCompare(String(an));
    });
  }, [data, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  function handleSort(col: string) {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null);
      setSortDir(null);
    }
    setPage(0);
  }

  const titleFontSize = title?.valueFontSize ?? 14;
  const titleColor = title?.valueFontColor ?? "var(--text)";

  if (data.length === 0 || cols.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
        {title?.value && (
          <p className="mb-4 self-start font-bold" style={{ fontSize: titleFontSize, color: titleColor }}>
            {title.value}
          </p>
        )}
        <p className="text-xs" style={{ color: "var(--text-2)" }}>
          {cols.length === 0 ? "Configure columns and run query" : "No data"}
        </p>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex h-full w-full min-h-0 flex-col" style={{ fontFamily: "inherit" }}>
      {title?.value && (
        <div className="shrink-0 px-3 pt-3 pb-1">
          <p
            className="font-bold leading-tight truncate"
            style={{ fontSize: titleFontSize, color: titleColor }}
          >
            {title.value}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto pointer-events-auto">
        <table className="w-full border-collapse text-xs" style={{ tableLayout: "auto" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "2px solid var(--border)" }}>
              {doShowIndex && (
                <th
                  className="px-3 py-2 text-left font-semibold select-none"
                  style={{ color: "var(--text-2)", whiteSpace: "nowrap", width: 40 }}
                >
                  #
                </th>
              )}
              {cols.map((col) => {
                const active = sortCol === col;
                return (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-semibold cursor-pointer select-none transition-colors hover:brightness-95"
                    style={{ color: active ? "var(--accent)" : "var(--text-2)", whiteSpace: "nowrap" }}
                    onClick={() => handleSort(col)}
                  >
                    <span className="flex items-center gap-1">
                      {aliases[col]}
                      <span className="opacity-50">
                        {active && sortDir === "asc" ? (
                          <MdArrowUpward size={11} />
                        ) : active && sortDir === "desc" ? (
                          <MdArrowDownward size={11} />
                        ) : (
                          <MdUnfoldMore size={11} />
                        )}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIdx) => {
              const globalIdx = safePage * rowsPerPage + rowIdx;
              const isEven = globalIdx % 2 === 0;
              return (
                <tr
                  key={globalIdx}
                  className="transition-colors"
                  style={{
                    background: isStriped && !isEven ? "var(--surface-2)" : "var(--surface)",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      isStriped && !isEven ? "var(--surface-2)" : "var(--surface)";
                  }}
                >
                  {doShowIndex && (
                    <td
                      className="px-3 py-2 tabular-nums"
                      style={{ color: "var(--text-2)", borderRight: "1px solid var(--border)" }}
                    >
                      {globalIdx + 1}
                    </td>
                  )}
                  {cols.map((col) => {
                    const raw = getRowFieldValue(row, col);
                    const isNum = raw != null && Number.isFinite(Number(raw));
                    return (
                      <td
                        key={col}
                        className="px-3 py-2 tabular-nums"
                        style={{
                          color: "var(--text)",
                          textAlign: isNum ? "right" : "left",
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatCell(raw)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-1.5"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-2)" }}>
            {safePage * rowsPerPage + 1}–{Math.min(safePage * rowsPerPage + rowsPerPage, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              ‹ Prev
            </button>
            <span className="text-[11px]" style={{ color: "var(--text-2)" }}>
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
