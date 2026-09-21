import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdAutoAwesome } from "react-icons/md";
import { FaPlus, FaTrash, FaSearch, FaCalendarAlt } from "react-icons/fa";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CConfirmDialog from "../components/CConfirmDialog";
import { getArtifacts, deleteArtifact, type ArtifactResponse } from "../lib/Api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function ArtifactsPage() {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<ArtifactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<ArtifactResponse | null>(null);

  function refresh() {
    setLoading(true);
    getArtifacts()
      .then(setArtifacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  const shown = artifacts.filter((a) =>
    `${a.name} ${a.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-6" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 flex items-center gap-3">
          <MdAutoAwesome size={20} style={{ color: "var(--accent)" }} />
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text-h)" }}>Artifacts</h1>
            <p className="text-xs" style={{ color: "var(--text)" }}>
              {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""} · AI-written analysis
              pages backed by your semantic models
            </p>
          </div>
          <CButton variant="primary" onClick={() => navigate("/artifacts/new")}>
            <FaPlus size={11} /> New artifact
          </CButton>
        </div>

        {error && <CAlert variant="error" message={error} className="mb-3" />}

        {artifacts.length > 0 && (
          <div className="mb-4 max-w-sm">
            <CTextInput type="search" value={search} onChange={setSearch}
                        placeholder="Search artifacts…" icon={<FaSearch size={12} />} />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><CSpinner /></div>
        ) : artifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border py-16 text-center"
               style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
            <MdAutoAwesome size={34} style={{ color: "var(--border)" }} />
            <p className="mt-3 text-sm font-semibold" style={{ color: "var(--text-h)" }}>
              No artifacts yet
            </p>
            <p className="mb-4 mt-1 text-xs" style={{ color: "var(--text)" }}>
              Describe an analysis and the agent writes the page for you.
            </p>
            <CButton variant="primary" onClick={() => navigate("/artifacts/new")}>
              <FaPlus size={11} /> New artifact
            </CButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((a) => (
              <div key={a.id}
                   onClick={() => navigate(`/artifacts/${a.id}`)}
                   className="flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition hover:border-[var(--accent)]"
                   style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--text-h)" }}>
                    {a.name}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "var(--text)" }}>
                    {a.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}>
                  v{a.current_version}
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-[11px] sm:flex"
                      style={{ color: "var(--text)" }}>
                  <FaCalendarAlt size={10} /> {formatDate(a.updated_at)}
                </span>
                <CButton variant="danger" className="!px-2 !py-1 !text-xs"
                         onClick={() => setDeleting(a)}>
                  <FaTrash size={11} />
                </CButton>
              </div>
            ))}
          </div>
        )}
      </div>

      <CConfirmDialog
        isOpen={Boolean(deleting)}
        title="Delete artifact"
        message={`Delete "${deleting?.name}"? Every version is removed permanently.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteArtifact(deleting.id);
            refresh();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}
