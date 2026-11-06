import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaSearch } from "react-icons/fa";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CConfirmDialog from "../components/CConfirmDialog";
import { BoardFill, BoardHead, BoardRow, EmptyBoard, PageHead, Panel, Status } from "../components/Board";
import { getSavedQueries, deleteSavedQuery, type QueryPublicResponse } from "../lib/Api";

/* Columns: when, name, which model, which cube, state, delete. */
const COLS = "88px minmax(0,1fr) 150px 140px 96px 40px";
/* On a phone the name keeps its width and the rest drops out. */
const COLS_NARROW = "62px minmax(0,1fr) 92px";

function editedTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function dateStamp(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" }).toUpperCase();
}

export default function QueriesPage() {
  const navigate = useNavigate();
  const [queries, setQueries] = useState<QueryPublicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<QueryPublicResponse | null>(null);
  const [removing, setRemoving] = useState(false);

  function refresh() {
    setLoading(true);
    setError("");
    getSavedQueries()
      .then((rows) => {
        setQueries(rows);
        setLoaded(true);
      })
      // A failed load is not an empty account: showing the "nothing here yet"
      // state for a request that never succeeded told people their work was
      // gone when the session had merely expired.
      .catch((e) => {
        setLoaded(false);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  const shown = queries.filter((q) =>
    `${q.name} ${q.description ?? ""} ${q.source} ${q.definition.model.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHead title="Queries" context={`${queries.length} quer${queries.length === 1 ? "y" : "ies"}, yours alone. The AI never reads them.`}>
        {queries.length > 0 && (
          <div className="w-full sm:w-64">
            <CTextInput
              type="search"
              value={search}
              onChange={setSearch}
              placeholder="Search queries…"
              icon={<FaSearch size={12} />}
            />
          </div>
        )}
        <CButton variant="primary" onClick={() => navigate("/queries/new")}>
          <FaPlus size={10} /> New query
        </CButton>
      </PageHead>

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {error && <CAlert variant="error" message={error} className="mb-3" />}

        <Panel className="relative" flush bodyClassName="flex flex-col">
          <BoardHead cols={COLS} colsNarrow={COLS_NARROW}>
            <span className="label">Updated</span>
            <span className="label">Query</span>
            <span className="label col-secondary">Model</span>
            <span className="label col-secondary">Source</span>
            <span className="label text-right">Status</span>
            <span className="label col-secondary text-right">·</span>
          </BoardHead>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20" style={{ color: "var(--text-3)" }}>
              <CSpinner size={18} />
              <span className="text-[12px]">Loading…</span>
            </div>
          ) : !loaded ? null : shown.length === 0 ? (
            <EmptyBoard
              line={queries.length === 0 ? "No queries yet" : "No matches"}
              hint={
                queries.length === 0
                  ? "Pick measures and dimensions from a semantic model, run it, and save the result. Queries stay private to your account and are never given to the AI."
                  : "Try a different search."
              }
              action={
                queries.length === 0 ? (
                  <CButton variant="primary" onClick={() => navigate("/queries/new")}>
                    <FaPlus size={10} /> Build your first query
                  </CButton>
                ) : undefined
              }
            />
          ) : (
            shown.map((q) => (
              <BoardRow
                key={q.id}
                cols={COLS}
                colsNarrow={COLS_NARROW}
                onClick={() => navigate(`/queries/${q.id}`)}
              >
                <span className="mono text-[13px]" style={{ color: "var(--text)" }}>
                  {editedTime(q.updated_at)}
                  <span className="ml-2 text-[10px]" style={{ color: "var(--text-3)" }}>
                    {dateStamp(q.updated_at)}
                  </span>
                </span>

                <span className="min-w-0">
                  <span className="font-medium block truncate text-[14px] leading-tight">{q.name}</span>
                  {q.description && (
                    <span
                      className="mt-0.5 block truncate text-[12px] leading-tight"
                      style={{ color: "var(--text-3)" }}
                    >
                      {q.description}
                    </span>
                  )}
                </span>

                <span className="col-secondary truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                  {q.definition.model.name}
                </span>

                <span className="mono col-secondary truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                  {q.source}
                </span>

                <span className="flex justify-end">
                  <Status signal="ok">Saved</Status>
                </span>

                <span className="col-secondary flex justify-end">
                  <button
                    type="button"
                    aria-label={`Delete ${q.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(q);
                    }}
                    className="p-1.5 transition-colors hover:text-[var(--danger)]"
                    style={{ color: "var(--text-3)" }}
                  >
                    <FaTrash size={11} />
                  </button>
                </span>
              </BoardRow>
            ))
          )}
          {!loading && shown.length > 0 && <BoardFill />}
        </Panel>
      </div>

      <CConfirmDialog
        isOpen={Boolean(deleting)}
        title="Delete query"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setRemoving(true);
          try {
            await deleteSavedQuery(deleting.id);
            refresh();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setRemoving(false);
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}
