import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaSyncAlt, FaHistory, FaPlus } from "react-icons/fa";
import { MdAutoAwesome, MdClose } from "react-icons/md";
import CButton from "../components/CButton";
import CSelect from "../components/CSelect";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import { Flap, Lamp, Panel, Status } from "../components/Board";
import {
  createArtifact,
  getAIModels,
  getAIThemes,
  getArtifact,
  getModels,
  queryArtifact,
  refineArtifact,
  renderArtifact,
  restoreArtifactVersion,
  type AIModelOption,
  type AITheme,
  type ArtifactResponse,
  type ModelResponse,
} from "../lib/Api";

interface Turn {
  version?: number;
  instruction: string;
  at?: string;
  model?: string;
  usage?: { in: number; out: number; reasoning: number } | null;
}

/* The real phases of a generation, in order. The board announces each one
   as it happens rather than hiding a two-minute wait behind a spinner —
   this is the product's slowest moment, so it is the one worth staging. */
const PHASES = [
  "READING SEMANTIC MODEL",
  "WRITING CUBE QUERIES",
  "VALIDATING AGAINST SCHEMA",
  "SAMPLING LIVE DATA",
  "COMPOSING THE PAGE",
];

function Cascade({ label }: { label: string }) {
  return (
    <span className="font-medium text-[15px]" style={{ color: "var(--accent)" }} key={label}>
      <Flap cascade>{label}</Flap>
    </span>
  );
}

/* The departure board while your artifact is built. */
function BuildingBoard({ heading }: { heading: string }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    // Advances on a timer: the backend runs two LLM turns with no progress
    // stream, so the board paces the real sequence rather than inventing a
    // percentage it cannot know. It holds on the last phase until done.
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 22000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xl" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lamp signal="live" live />
          <span className="label" style={{ color: "var(--text)" }}>
            {heading}
          </span>
        </div>
        <div className="px-5 py-7">
          <Cascade label={PHASES[phase]} />
          <div className="mt-6 flex flex-col gap-1.5">
            {PHASES.map((p, i) => (
              <div key={p} className="flex items-center gap-3">
                <Lamp signal={i < phase ? "ok" : i === phase ? "live" : "idle"} live={i === phase} />
                <span
                  className=" text-[11px]"
                  style={{ color: i <= phase ? "var(--text-2)" : "var(--text-3)" }}
                >
                  {p}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            A reasoning model writes the whole page. Two to three minutes is normal — the board
            holds until it lands.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ArtifactWorkspace() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const navigate = useNavigate();
  const isNew = !artifactId;

  const [artifact, setArtifact] = useState<ArtifactResponse | null>(null);
  const [srcDoc, setSrcDoc] = useState("");
  const [viewing, setViewing] = useState<number | undefined>(undefined);

  const [providers, setProviders] = useState<AIModelOption[]>([]);
  const [themes, setThemes] = useState<AITheme[]>([]);
  const [semanticModels, setSemanticModels] = useState<ModelResponse[]>([]);
  const [providerId, setProviderId] = useState("");
  const [semanticModelId, setSemanticModelId] = useState("");
  const [theme, setTheme] = useState("");

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notesOpen, setNotesOpen] = useState(true);
  const [queriesRun, setQueriesRun] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  /* The page runs on an opaque origin and cannot reach the API. It asks
     here; this component is authenticated, so it answers. That is what lets
     every chart be a live query without ever giving the sandbox a token. */
  useEffect(() => {
    async function onMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg || msg.source !== "chester-page" || !artifactId) return;
      const frame = frameRef.current;
      if (!frame || e.source !== frame.contentWindow) return;

      const reply = (body: Record<string, unknown>) =>
        frame.contentWindow?.postMessage({ source: "chester-host", rid: msg.rid, ...body }, "*");

      try {
        const result = await queryArtifact(artifactId, msg.queryId, msg.filters ?? undefined, viewing);
        setQueriesRun((n) => n + 1);
        reply({ rows: result.rows });
      } catch (err: any) {
        reply({ error: err?.message ?? "Query failed" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [artifactId, viewing]);

  useEffect(() => {
    Promise.all([getAIModels(), getAIThemes(), getModels()])
      .then(([p, t, sm]) => {
        setProviders(p);
        if (p.length === 1) setProviderId(p[0].provider_id);
        setThemes(t);
        setSemanticModels(sm.filter((m) => m.is_active));
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(
    async (version?: number) => {
      if (!artifactId) return;
      setError("");
      try {
        const [meta, html] = await Promise.all([getArtifact(artifactId), renderArtifact(artifactId, version)]);
        setArtifact(meta);
        setSrcDoc(html);
        setViewing(version ?? meta.current_version);
        setQueriesRun(0);
        setTheme((t) => t || meta.theme);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [artifactId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!artifactId) return;
    const key = `artifact-warnings-${artifactId}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      setWarnings(stored.split("\n"));
      sessionStorage.removeItem(key);
    }
  }, [artifactId]);

  const turns: Turn[] = useMemo(
    () =>
      (artifact?.prompts ?? []).map((p, i) => ({
        version: p.version ?? i + 1,
        instruction: p.instruction,
        at: p.at,
        model: p.model,
        usage: p.usage,
      })),
    [artifact],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, notesOpen]);

  const activeProvider = providers.find((p) => p.provider_id === providerId);
  const canSend = isNew
    ? Boolean(providerId && semanticModelId && theme && input.trim().length >= 10 && !busy)
    : Boolean(input.trim().length >= 3 && !busy);

  async function send() {
    const instruction = input.trim();
    setInput("");
    setBusy(true);
    setError("");
    try {
      if (isNew) {
        const created = await createArtifact({
          provider_id: providerId,
          semantic_model_id: semanticModelId,
          theme,
          brief: instruction,
        });
        if (created.warnings?.length) {
          sessionStorage.setItem(`artifact-warnings-${created.id}`, created.warnings.join("\n"));
        }
        navigate(`/artifacts/${created.id}`, { replace: true });
      } else {
        await refineArtifact(artifactId!, { instruction });
        await load();
      }
    } catch (e: any) {
      setError(e.message);
      setInput(instruction);
    } finally {
      setBusy(false);
    }
  }

  async function restore(version: number) {
    if (!artifactId) return;
    setBusy(true);
    try {
      await restoreArtifactVersion(artifactId, version);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  /* ── Setting the board: a new departure ─────────────────────────────── */
  if (isNew) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex shrink-0 items-center gap-3 px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={() => navigate("/artifacts")}
            className="p-1 transition-colors hover:text-[var(--accent)]"
            style={{ color: "var(--text-2)" }}
            aria-label="Back to the board"
          >
            <FaArrowLeft size={12} />
          </button>
          <h1 className="font-medium relative z-10 text-[15px] leading-none">New artifact</h1>
        </header>

        {busy ? (
          <BuildingBoard heading="Building Artifact" />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-3">
            <div className="mx-auto w-full max-w-3xl">
              {error && <CAlert variant="error" message={error} className="mb-3" />}
              {providers.length === 0 && (
                <CAlert
                  variant="warning"
                  message="No AI provider configured. Add one under AI Providers before setting a departure."
                  className="mb-3"
                />
              )}
              {semanticModels.length === 0 && (
                <CAlert
                  variant="warning"
                  message="No semantic model yet. Define one under Models — it is what bounds every question."
                  className="mb-3"
                />
              )}

              <Panel label="New artifact" flush>
                <div className="px-5 py-6">
                  <p className="font-medium mb-1 text-[19px] leading-tight">What should this artifact show?</p>
                  <p className="mb-5 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                    Plain language. Chester reads the semantic model you pick, writes its own Cube
                    queries, and publishes a page — charts, written analysis and working filters.
                  </p>

                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={5}
                    disabled={busy}
                    placeholder="e.g. A quarterly sales review: revenue and order KPIs, a monthly trend, a regional breakdown, a written summary of what changed, and filters for date range and region."
                    className="w-full resize-none border px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div
                  className="grid gap-3 px-5 py-4 sm:grid-cols-3"
                  style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
                >
                  <CSelect
                    label="Model"
                    value={providerId}
                    onChange={setProviderId}
                    options={providers.map((p) => ({
                      value: p.provider_id,
                      label: p.model ?? `${p.label} (no model)`,
                    }))}
                    placeholder="Model…"
                    required
                  />
                  <CSelect
                    label="Semantic Model"
                    value={semanticModelId}
                    onChange={setSemanticModelId}
                    options={semanticModels.map((m) => ({ value: m.id, label: m.name }))}
                    placeholder="Semantic model…"
                    required
                  />
                  <CSelect
                    label="Theme"
                    value={theme}
                    onChange={setTheme}
                    options={themes.map((t) => ({ value: t.name, label: t.name }))}
                    placeholder="Theme…"
                    required
                  />
                </div>

                <div
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {theme && (
                    <span className="flex items-center gap-1.5">
                      {(themes.find((t) => t.name === theme)?.colors ?? []).map((c) => (
                        <span key={c} className="h-4 w-4" style={{ background: c }} title={c} />
                      ))}
                    </span>
                  )}
                  <div className="ml-auto">
                    <CButton variant="primary" disabled={!canSend} onClick={send}>
                      <MdAutoAwesome size={13} /> Create artifact
                    </CButton>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── The departure: the artifact is the hero ────────────────────────── */
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* This artifact's own departure row, lifted out of the board */}
      <header
        className="flex shrink-0 flex-wrap items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/artifacts")}
          className="p-1 transition-colors hover:text-[var(--accent)]"
          style={{ color: "var(--text-2)" }}
          aria-label="Back to the board"
        >
          <FaArrowLeft size={12} />
        </button>

        <div className="min-w-0">
          <h1 className="font-medium truncate text-[15px] leading-none">{artifact?.name ?? "Artifact"}</h1>
          <p className="label mt-1 truncate leading-none">{artifact?.description}</p>
        </div>

        {artifact && viewing !== undefined && (
          <span className="flex items-center gap-2">
            <span className="mono text-[13px]" style={{ color: "var(--accent)" }}>
              v{viewing}
            </span>
            {viewing !== artifact.current_version && (
              <span className=" text-[10px]" style={{ color: "var(--text-3)" }}>
                of {artifact.current_version}
              </span>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Status signal={busy ? "live" : "ok"} live={busy}>
            {busy ? "Building" : queriesRun > 0 ? `Live · ${queriesRun} queries` : "Live data"}
          </Status>
          <CButton variant="outline" disabled={busy || loading} onClick={() => load(viewing)}>
            <FaSyncAlt size={10} /> Refresh
          </CButton>
          {!notesOpen && (
            <CButton variant="primary" onClick={() => setNotesOpen(true)}>
              <MdAutoAwesome size={12} /> Prompt
            </CButton>
          )}
        </div>
      </header>

      {error && <CAlert variant="error" message={error} className="m-3" />}
      {warnings.map((w, i) => (
        <CAlert key={i} variant="warning" message={w} className="mx-3 mt-2" />
      ))}

      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: "var(--bg)" }}>
        {busy ? (
          <BuildingBoard heading="Rewriting Artifact" />
        ) : (
          <>
            {loading && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center gap-3"
                style={{ background: "var(--bg)" }}
              >
                <CSpinner size={18} />
                <span className=" text-[12px]" style={{ color: "var(--text-3)" }}>
                  Querying Cube
                </span>
              </div>
            )}
            {/* The lit document on the table: the board is dark so the page reads.
                allow-scripts WITHOUT allow-same-origin — generated JS runs on an
                opaque origin and cannot reach this app's session. */}
            <iframe
              ref={frameRef}
              title={artifact?.name ?? "Artifact"}
              srcDoc={srcDoc}
              sandbox="allow-scripts"
              className="h-full w-full border-0"
              style={{ background: "#fff" }}
            />
          </>
        )}

        {/* Operator notes: the prompt thread, mounted over the hall */}
        {notesOpen && !busy && (
          <div
            className="absolute bottom-3 right-3 z-20 flex max-h-[74%] w-[360px] flex-col"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              boxShadow: "0 24px 56px -12px rgba(0,0,0,0.75)",
            }}
          >
            <div
              className="flex shrink-0 items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="label relative z-10 flex-1" style={{ color: "var(--text)" }}>
                Prompts
              </span>
              <span className=" relative z-10 text-[10px]" style={{ color: "var(--text-3)" }}>
                {activeProvider?.model ?? artifact?.llm_model}
              </span>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                aria-label="Hide notes"
                className="p-0.5 transition-colors hover:text-[var(--accent)]"
                style={{ color: "var(--text-2)" }}
              >
                <MdClose size={15} />
              </button>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {turns.map((turn, i) => (
                <div key={i} className="mb-3.5">
                  <p
                    className="ml-5 rounded-[var(--r)] rounded-br-sm px-3 py-2 text-[13px] leading-relaxed"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    {turn.instruction}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => load(turn.version)}
                      title="Show this version"
                      className="mono flex items-center gap-1 border px-1.5 py-0.5 text-[11px] transition-colors"
                      style={{
                        borderColor: viewing === turn.version ? "var(--accent)" : "var(--border)",
                        color: viewing === turn.version ? "var(--accent)" : "var(--text-2)",
                      }}
                    >
                      <FaHistory size={8} /> v{turn.version}
                    </button>
                    {artifact && turn.version !== artifact.current_version && (
                      <button
                        type="button"
                        onClick={() => restore(turn.version!)}
                        className=" text-[10px] underline transition-colors hover:text-[var(--accent)]"
                        style={{ color: "var(--text-3)" }}
                      >
                        Restore
                      </button>
                    )}
                    {turn.at && (
                      <span className="mono text-[10px]" style={{ color: "var(--text-3)" }}>
                        {new Date(turn.at).toLocaleString(undefined, {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                    )}
                    {turn.usage && (
                      <span
                        className="mono text-[10px]"
                        style={{ color: "var(--text-3)" }}
                        title={`${turn.usage.in} in · ${turn.usage.out} out, of which ${turn.usage.reasoning} hidden reasoning`}
                      >
                        {((turn.usage.in + turn.usage.out) / 1000).toFixed(1)}k tokens
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 p-2" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend) send();
                    }
                  }}
                  rows={2}
                  disabled={busy}
                  placeholder="Ask for a change — e.g. add a regional breakdown"
                  className="min-h-0 flex-1 resize-none border px-2.5 py-1.5 text-[13px] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}
                />
                <CButton variant="primary" className="!px-2.5 !py-2" disabled={!canSend} onClick={send}>
                  <FaPaperPlane size={11} />
                </CButton>
              </div>
              <p className="label mt-1.5 px-0.5" style={{ fontSize: 10 }}>
                Enter sends · every prompt sets a new version
              </p>
            </div>
          </div>
        )}

        {!notesOpen && !busy && (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className=" absolute bottom-3 right-3 z-20 flex items-center gap-2 px-4 py-2.5 text-[11px]"
            style={{ background: "var(--solid)", color: "var(--solid-ink)", borderRadius: "var(--r)", boxShadow: "var(--shadow-3)" }}
          >
            <FaPlus size={10} /> Prompt · v{artifact?.current_version}
          </button>
        )}
      </div>
    </div>
  );
}
