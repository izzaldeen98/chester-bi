import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaSearch } from "react-icons/fa";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CConfirmDialog from "../components/CConfirmDialog";
import { BoardFill, BoardHead, BoardRow, EmptyBoard, Flap, Panel, Status } from "../components/Board";
import { getArtifacts, deleteArtifact, type ArtifactResponse } from "../lib/Api";

/* Columns never move: time, destination, model, version, status, service. */
const COLS = "88px minmax(0,1fr) 150px 64px 104px 40px";
/* Phone priority: when the board narrows, the destination keeps its width
   and the secondary columns drop out. */
const COLS_NARROW = "62px minmax(0,1fr) 92px";

function departureTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dateStamp(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" }).toUpperCase();
}

export default function ArtifactsPage() {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<ArtifactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<ArtifactResponse | null>(null);
  const [removing, setRemoving] = useState(false);

  function refresh() {
    setLoading(true);
    getArtifacts()
      .then(setArtifacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  const shown = artifacts
    .filter((a) => `${a.name} ${a.description ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header
        className="flex shrink-0 flex-wrap items-center gap-4 px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-none tracking-[-0.02em]">Artifacts</h1>
          <p className="mt-1.5 text-[13px] leading-none" style={{ color: "var(--text-3)" }}>
            {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"} · re-queried live on every open
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {artifacts.length > 0 && (
            <div className="hidden w-56 sm:block">
              <CTextInput
                type="search"
                value={search}
                onChange={setSearch}
                placeholder="Search artifacts…"
                icon={<FaSearch size={11} />}
              />
            </div>
          )}
          <CButton variant="primary" onClick={() => navigate("/artifacts/new")}>
            <FaPlus size={10} /> New artifact
          </CButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div aria-hidden className="grid-paper pointer-events-none absolute inset-0" />
        {error && <CAlert variant="error" message={error} className="mb-3" />}

        <Panel className="relative" label="All artifacts" flush bodyClassName="flex flex-col">
          <BoardHead cols={COLS} colsNarrow={COLS_NARROW}>
            <span className="label">Updated</span>
            <span className="label">Artifact</span>
            <span className="label col-secondary">Built with</span>
            <span className="label col-secondary text-right">Ver</span>
            <span className="label text-right">Status</span>
            <span className="label col-secondary text-right">·</span>
          </BoardHead>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20" style={{ color: "var(--text-3)" }}>
              <CSpinner size={18} />
              <span className=" text-[12px]">Loading…</span>
            </div>
          ) : shown.length === 0 ? (
            <EmptyBoard
              line={artifacts.length === 0 ? "No artifacts yet" : "No matches"}
              hint={
                artifacts.length === 0
                  ? "Describe the analysis you want. Chester reads your semantic model, writes the queries, and publishes a page that re-queries live data every time it opens."
                  : "Try a different search."
              }
              action={
                artifacts.length === 0 ? (
                  <CButton variant="primary" onClick={() => navigate("/artifacts/new")}>
                    <FaPlus size={10} /> Create your first artifact
                  </CButton>
                ) : undefined
              }
            />
          ) : (
            shown.map((a) => (
              <BoardRow key={a.id} cols={COLS} colsNarrow={COLS_NARROW} onClick={() => navigate(`/artifacts/${a.id}`)}>
                <span className="mono text-[13px]" style={{ color: "var(--text)" }}>
                  {departureTime(a.updated_at)}
                  <span className="ml-2 text-[10px]" style={{ color: "var(--text-3)" }}>
                    {dateStamp(a.updated_at)}
                  </span>
                </span>

                <span className="min-w-0">
                  <span className="font-medium block truncate text-[14px] leading-tight">
                    <Flap>{a.name}</Flap>
                  </span>
                  {a.description && (
                    <span
                      className="mt-0.5 block truncate text-[12px] leading-tight"
                      style={{ color: "var(--text-3)" }}
                    >
                      {a.description}
                    </span>
                  )}
                </span>

                <span className=" col-secondary truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                  {a.llm_model}
                </span>

                <span className="mono col-secondary text-right text-[13px]" style={{ color: "var(--text-3)" }}>
                  v{a.current_version}
                </span>

                <span className="flex justify-end">
                  <Status signal="ok">Ready</Status>
                </span>

                <span className="col-secondary flex justify-end">
                  <button
                    type="button"
                    aria-label={`Delete ${a.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(a);
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
        title="Delete artifact"
        message={`Delete "${deleting?.name}"? Every saved version goes with it. This cannot be undone.`}
        confirmLabel="Delete"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setRemoving(true);
          try {
            await deleteArtifact(deleting.id);
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
