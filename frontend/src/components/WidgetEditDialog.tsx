import { useEffect, useMemo, useState } from "react";
import { FaDatabase, FaSearch } from "react-icons/fa";
import { PiFileSqlFill } from "react-icons/pi";
import { IoBarChartSharp } from "react-icons/io5";
import CDialog from "./CDialog";
import CTextInput from "./CTextInput";
import CAlert from "./CAlert";
import CSpinner from "./CSpinner";
import CDetailRow from "./CDetailRow";
import { getQueries, type QueryPublicResponse } from "../lib/Api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getQueryInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface WidgetEditDialogProps {
  isOpen: boolean;
  widgetTitle: string;
  onClose: () => void;
  onSave?: (query: QueryPublicResponse | null) => void;
}

export default function WidgetEditDialog({
  isOpen,
  widgetTitle,
  onClose,
  onSave,
}: WidgetEditDialogProps) {
  const [queries, setQueries] = useState<QueryPublicResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSearch("");
    setSelectedId(null);
    setError("");
    setLoading(true);

    getQueries()
      .then(setQueries)
      .catch((e: Error) => setError(e.message ?? "Failed to load queries."))
      .finally(() => setLoading(false));
  }, [isOpen]);

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

  async function handleSave() {
    if (!onSave) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <CDialog
      isOpen={isOpen}
      title={`Edit ${widgetTitle}`}
      subtitle="Choose a query and configure how this widget displays"
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={!selected}
      saveLabel="Apply"
    >
      <div className="flex h-full min-h-0">
        {/* Query list */}
        <aside
          className="flex w-full max-w-sm shrink-0 flex-col border-r"
          style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
        >
          <div className="shrink-0 border-b p-4" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
              Queries
            </p>
            <CTextInput
              value={search}
              onChange={setSearch}
              placeholder="Search queries…"
              icon={<FaSearch size={12} />}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <CSpinner size={24} />
              </div>
            ) : error ? (
              <CAlert variant="error" message={error} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <PiFileSqlFill size={28} style={{ color: "var(--border)" }} />
                <p className="mt-2 text-sm" style={{ color: "var(--text)" }}>
                  {search ? "No queries match your search." : "No queries available yet."}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {filtered.map((query) => {
                  const isSelected = query.id === selectedId;
                  return (
                    <li key={query.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(query.id)}
                        className="w-full rounded-xl border p-3 text-left transition-all"
                        style={{
                          background: isSelected ? "var(--accent-muted)" : "var(--bg)",
                          borderColor: isSelected ? "var(--accent-ring)" : "var(--border)",
                          boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                            style={{
                              background: isSelected ? "var(--accent)" : "var(--bg-subtle)",
                              color: isSelected ? "var(--accent-fg)" : "var(--accent)",
                              border: `1px solid ${isSelected ? "var(--accent)" : "var(--accent-ring)"}`,
                            }}
                          >
                            {getQueryInitials(query.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm font-semibold"
                              style={{ color: "var(--text-h)" }}
                            >
                              {query.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text)" }}>
                              {query.semantic_model.package.name} · {query.semantic_model.name}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Details panel */}
        <section className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-ring)",
                }}
              >
                <IoBarChartSharp size={24} />
              </span>
              <p className="mt-4 text-sm font-semibold" style={{ color: "var(--text-h)" }}>
                Select a query
              </p>
              <p className="mt-1 max-w-xs text-xs" style={{ color: "var(--text)" }}>
                Pick a saved query from the list to connect it to this widget.
              </p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-6 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold"
                  style={{
                    background: "var(--accent-muted)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-ring)",
                  }}
                >
                  {getQueryInitials(selected.name)}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold" style={{ color: "var(--text-h)" }}>
                    {selected.name}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text)" }}>
                    {selected.description || "No description"}
                  </p>
                </div>
              </div>

              <div
                className="mb-6 rounded-2xl border p-4"
                style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>
                  Query details
                </p>
                <CDetailRow label="Package" value={selected.semantic_model.package.name} />
                <CDetailRow label="Model" value={selected.semantic_model.name} />
                <CDetailRow label="Source" value={selected.source} />
                <CDetailRow label="Created" value={formatDate(selected.created_at)} />
                <CDetailRow label="Created by" value={selected.created_by} />
              </div>

              <div
                className="flex items-start gap-3 rounded-2xl border border-dashed p-4"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              >
                <FaDatabase size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
                    Chart settings
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text)" }}>
                    Visualization options for this widget will appear here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </CDialog>
  );
}
