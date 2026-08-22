import CSpinner from "./CSpinner";

interface CTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  emptyMessage?: string;
  maxHeight?: string;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Cube keys result rows as "Cube.field" — show just "field" as the header,
// keep the full key as the row accessor so lookups still work.
function shortColumnTitle(col: string): string {
  const dot = col.lastIndexOf(".");
  return dot === -1 ? col : col.slice(dot + 1);
}

export default function CTable({
  columns,
  rows,
  loading = false,
  emptyMessage = "No results.",
  maxHeight = "100%",
}: CTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <CSpinner size={24} />
      </div>
    );
  }

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm" style={{ color: "var(--text)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr style={{ background: "var(--bg-subtle)", position: "sticky", top: 0, zIndex: 1 }}>
            {columns.map((col) => (
              <th
                key={col}
                title={col}
                className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                style={{
                  color: "var(--text-h)",
                  borderBottom: "2px solid var(--border)",
                  borderRight: "1px solid var(--border)",
                }}
              >
                {shortColumnTitle(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="transition-colors"
              style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--accent-muted)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)"; }}
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-1.5 font-mono whitespace-nowrap"
                  style={{
                    color: "var(--text-h)",
                    borderBottom: "1px solid var(--border)",
                    borderRight: "1px solid var(--border)",
                    maxWidth: "280px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={formatCell(row[col])}
                >
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div
        className="px-3 py-1.5 text-xs"
        style={{ color: "var(--text)", borderTop: "1px solid var(--border)", background: "var(--bg-subtle)" }}
      >
        {rows.length} row{rows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
