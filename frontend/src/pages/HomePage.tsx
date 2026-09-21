import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdAutoAwesome, MdOutlineCloud } from "react-icons/md";
import { GoPackage } from "react-icons/go";
import { FaPlus, FaArrowRight } from "react-icons/fa";
import { getUser } from "../lib/auth";
import {
  getArtifacts,
  getConnections,
  getModels,
  getUsers,
  type ArtifactResponse,
  type ConnectionPublicResponse,
} from "../lib/Api";
import { BoardFill, BoardHead, BoardRow, EmptyBoard, Flap, Lamp, Panel, Readout, Status } from "../components/Board";
import CButton from "../components/CButton";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";

const COLS = "88px minmax(0,1fr) 150px 74px 108px";
const COLS_NARROW = "62px minmax(0,1fr) 92px";

function departureTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/* The pipeline is the product's one path. Showing it as an ordered run of
   stages with live counts is what makes "where am I, what next" answerable
   without a tutorial. */
function PipelineStage({
  n,
  label,
  count,
  done,
  icon,
  onClick,
}: {
  n: string;
  label: string;
  count: number | null;
  done: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-[filter] hover:brightness-[1.4]"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <span className="mono text-[11px]" style={{ color: "var(--text-3)" }}>
        {n}
      </span>
      <span style={{ color: done ? "var(--accent)" : "var(--text-3)" }}>{icon}</span>
      <span className=" flex-1 text-[12px]" style={{ color: "var(--text)" }}>
        {label}
      </span>
      <span className="mono text-[15px]" style={{ color: done ? "var(--ok)" : "var(--text-3)" }}>
        {count === null ? "—" : count}
      </span>
      <Lamp signal={done ? "ok" : "idle"} />
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const user = getUser();

  const [artifacts, setArtifacts] = useState<ArtifactResponse[] | null>(null);
  const [connections, setConnections] = useState<ConnectionPublicResponse[] | null>(null);
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([getArtifacts(), getConnections(), getModels(), getUsers()]);
      if (cancelled) return;
      const errs: string[] = [];
      if (results[0].status === "fulfilled") setArtifacts(results[0].value);
      else errs.push("artifacts");
      if (results[1].status === "fulfilled") setConnections(results[1].value);
      else setConnections([]);
      if (results[2].status === "fulfilled") setModelCount(results[2].value.length);
      else setModelCount(0);
      if (results[3].status === "fulfilled") setUserCount(results[3].value.length);
      else setUserCount(0);
      setErrors(errs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = artifacts
    ? [...artifacts].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 7)
    : [];
  const firstName = user?.first_name ?? user?.username ?? "operator";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Concourse header: who is on shift, and the one action that matters */}
      <header
        className="flex shrink-0 flex-wrap items-center gap-4 px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-none tracking-[-0.02em]">Overview</h1>
          <p className="mt-1.5 text-[13px] leading-none" style={{ color: "var(--text-3)" }}>
            {firstName} · {user?.account_name ?? "—"} · {user?.role ?? "—"}
          </p>
        </div>
        <div className="ml-auto">
          <CButton variant="primary" onClick={() => navigate("/artifacts/new")}>
            <FaPlus size={10} /> New artifact
          </CButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {errors.length > 0 && (
          <CAlert variant="error" message={`Could not reach: ${errors.join(", ")}.`} className="mb-3" />
        )}

        <div className="relative grid items-start gap-4 lg:grid-cols-[1fr_300px]">
          {/* ── The board ────────────────────────────────────────────── */}
          <Panel
            label="Recent artifacts"
            flush
            bodyClassName="flex flex-col"
            action={
              <button
                type="button"
                onClick={() => navigate("/artifacts")}
                className=" text-[11px] transition-colors hover:text-[var(--accent)]"
                style={{ color: "var(--text-2)" }}
              >
                View all <FaArrowRight size={9} className="inline" />
              </button>
            }
          >
            <BoardHead cols={COLS} colsNarrow={COLS_NARROW}>
              <span className="label">Updated</span>
              <span className="label">Artifact</span>
              <span className="label col-secondary">Model</span>
              <span className="label col-secondary text-right">Ver</span>
              <span className="label text-right">Status</span>
            </BoardHead>

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-16" style={{ color: "var(--text-3)" }}>
                <CSpinner size={18} />
                <span className=" text-[12px]">Loading…</span>
              </div>
            ) : recent.length === 0 ? (
              <EmptyBoard
                line="No artifacts yet"
                hint="Describe an analysis and Chester writes the page — charts, narrative and filters — from your semantic model."
                action={
                  <CButton variant="primary" onClick={() => navigate("/artifacts/new")}>
                    <FaPlus size={10} /> Create your first artifact
                  </CButton>
                }
              />
            ) : (
              recent.map((a) => (
                <BoardRow key={a.id} cols={COLS} colsNarrow={COLS_NARROW} onClick={() => navigate(`/artifacts/${a.id}`)}>
                  <span className="mono text-[13px]" style={{ color: "var(--text)" }}>
                    {departureTime(a.updated_at)}
                  </span>
                  <span className="font-medium truncate text-[14px]">
                    <Flap>{a.name}</Flap>
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
                </BoardRow>
              ))
            )}
            {!loading && recent.length > 0 && <BoardFill />}
          </Panel>

          {/* ── Right rail ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <Panel label="Setup" flush bodyClassName="flex flex-col">
              <PipelineStage
                n="01"
                label="Connections"
                count={connections?.length ?? null}
                done={Boolean(connections?.length)}
                icon={<MdOutlineCloud size={15} />}
                onClick={() => navigate("/connections")}
              />
              <PipelineStage
                n="02"
                label="Models"
                count={modelCount}
                done={Boolean(modelCount)}
                icon={<GoPackage size={14} />}
                onClick={() => navigate("/models")}
              />
              <PipelineStage
                n="03"
                label="Artifacts"
                count={artifacts?.length ?? null}
                done={Boolean(artifacts?.length)}
                icon={<MdAutoAwesome size={15} />}
                onClick={() => navigate("/artifacts")}
              />
            </Panel>

            <Panel label="Workspace">
              <div className="grid grid-cols-2 gap-2">
                <Readout value={artifacts?.length ?? 0} label="Artifacts" />
                <Readout value={userCount ?? 0} label="Team members" />
              </div>
            </Panel>

            <Panel label="Quick actions">
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "New artifact", to: "/artifacts/new" },
                  { label: "Add connection", to: "/connections" },
                  { label: "Edit models", to: "/models" },
                  { label: "AI Providers", to: "/settings/ai-providers" },
                ].map((a) => (
                  <button
                    key={a.to}
                    type="button"
                    onClick={() => navigate(a.to)}
                    className=" flex items-center justify-between border px-3 py-2 text-[11px] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
                  >
                    {a.label}
                    <FaArrowRight size={8} />
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
