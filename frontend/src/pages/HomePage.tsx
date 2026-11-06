import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import { getUser } from "../lib/auth";
import {
  getArtifacts,
  getConnections,
  getModels,
  type ArtifactResponse,
  type ConnectionPublicResponse,
} from "../lib/Api";
import { BoardFill, BoardHead, BoardRow, EmptyBoard, Flap, PageHead, Panel, Status } from "../components/Board";
import CButton from "../components/CButton";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";

const COLS = "88px minmax(0,1fr) 150px 74px 108px";
const COLS_NARROW = "62px minmax(0,1fr) 92px";

// Time alone for today, the date otherwise: "21:14" means nothing a month later.
function departureTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* The pipeline is the product's one path, and the overview's one bold
   element: three stages in order, each with its live count. The first stage
   still at zero is the one that is lit, so "what next" never needs a tour. */
type Stage = { step: number; title: string; noun: string; hint: string; count: number | null; to: string; cta: string };

function Pipeline({ stages, onGo }: { stages: Stage[]; onGo: (to: string) => void }) {
  const loaded = stages.every((s) => s.count !== null);
  const nextIdx = loaded ? stages.findIndex((s) => !s.count) : -1;
  const current = nextIdx === -1 ? stages.length - 1 : nextIdx;
  return (
    <ol
      className="settle grid overflow-hidden md:grid-cols-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {stages.map((s, i) => {
        const lit = loaded && i === current;
        const done = Boolean(s.count);
        return (
          <li
            key={s.step}
            className="relative flex flex-col gap-3 p-5"
            style={{
              borderLeft: i ? "1px solid var(--border)" : undefined,
              boxShadow: lit ? "inset 0 2px 0 var(--accent-bold)" : undefined,
            }}
          >
            <div className="flex items-center gap-2 text-[13px]">
              <span
                className="tnum grid h-5 w-5 place-items-center rounded-full text-[11px] font-medium"
                style={{
                  background: done ? "var(--ok-soft)" : lit ? "var(--accent-soft)" : "var(--surface-2)",
                  color: done ? "var(--ok)" : lit ? "var(--accent)" : "var(--text-3)",
                }}
              >
                {s.step}
              </span>
              <span className="font-medium" style={{ color: "var(--text)" }}>{s.title}</span>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="tnum text-[32px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "var(--text)" }}>
                {s.count ?? "–"}
              </span>
              <span className="text-[13px]" style={{ color: "var(--text-3)" }}>{s.noun}</span>
            </p>
            <p className="max-w-[34ch] text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>{s.hint}</p>
            <div className="mt-auto pt-1">
              <CButton variant={lit ? "primary" : "outline"} onClick={() => onGo(s.to)}>
                {s.cta}
              </CButton>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const user = getUser();

  const [artifacts, setArtifacts] = useState<ArtifactResponse[] | null>(null);
  const [connections, setConnections] = useState<ConnectionPublicResponse[] | null>(null);
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([getArtifacts(), getConnections(), getModels()]);
      if (cancelled) return;
      const errs: string[] = [];
      if (results[0].status === "fulfilled") setArtifacts(results[0].value);
      else errs.push("artifacts");
      if (results[1].status === "fulfilled") setConnections(results[1].value);
      else setConnections([]);
      if (results[2].status === "fulfilled") setModelCount(results[2].value.length);
      else setModelCount(0);
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
  const firstName = user?.first_name || user?.username || "Welcome";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHead title="Overview" context={`${firstName}, ${user?.account_name ?? "your workspace"}`} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {errors.length > 0 && (
          <CAlert variant="error" message={`Could not reach: ${errors.join(", ")}.`} className="mb-3" />
        )}

        <Pipeline
          onGo={navigate}
          stages={[
            { step: 1, title: "Connect", noun: connections?.length === 1 ? "connection" : "connections", count: connections?.length ?? null,
              hint: "A database Chester queries live. Credentials are encrypted and never leave this server.", to: "/connections", cta: "Add a connection" },
            { step: 2, title: "Model", noun: modelCount === 1 ? "semantic model" : "semantic models", count: modelCount,
              hint: "Measures and dimensions the AI is allowed to use. It answers nothing outside them.", to: "/models", cta: "Open models" },
            { step: 3, title: "Ask", noun: artifacts?.length === 1 ? "artifact" : "artifacts", count: artifacts?.length ?? null,
              hint: "Describe the analysis in a sentence. Chester writes the page from your model.", to: "/artifacts/new", cta: "New artifact" },
          ]}
        />

        <Panel
            label="Recent artifacts"
            flush
            bodyClassName="flex flex-col"
            action={
              <button
                type="button"
                onClick={() => navigate("/artifacts")}
                className="text-[13px] transition-colors hover:text-[var(--text)]"
                style={{ color: "var(--text-2)" }}
              >
                View all
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

      </div>
    </div>
  );
}
