import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaMagic, FaSyncAlt, FaPaperPlane, FaHistory } from "react-icons/fa";
import { MdAutoAwesome, MdClose, MdChevronRight } from "react-icons/md";
import CButton from "../components/CButton";
import CSelect from "../components/CSelect";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import {
  createArtifact,
  getAIModels,
  getAIThemes,
  getArtifact,
  getModels,
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
  pending?: boolean;
}

export default function ArtifactWorkspace() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const navigate = useNavigate();
  const isNew = !artifactId;

  const [artifact, setArtifact] = useState<ArtifactResponse | null>(null);
  const [srcDoc, setSrcDoc] = useState("");
  const [viewing, setViewing] = useState<number | undefined>(undefined); // version in the frame
  const [pending, setPending] = useState<Turn | null>(null);

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
  const [chatOpen, setChatOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Setup options ────────────────────────────────────────────────────────
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

  // ── Load an existing artifact ────────────────────────────────────────────
  const load = useCallback(
    async (version?: number) => {
      if (!artifactId) return;
      setError("");
      try {
        const [meta, html] = await Promise.all([
          getArtifact(artifactId),
          renderArtifact(artifactId, version),
        ]);
        setArtifact(meta);
        setSrcDoc(html);
        setViewing(version ?? meta.current_version);
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

  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    if (!artifactId) return;
    const key = `artifact-warnings-${artifactId}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      setWarnings(stored.split("\n"));
      sessionStorage.removeItem(key);
    }
  }, [artifactId]);

  const turns: Turn[] = useMemo(() => {
    const history = (artifact?.prompts ?? []).map((p, i) => ({
      version: p.version ?? i + 1,
      instruction: p.instruction,
      at: p.at,
      model: p.model,
      usage: p.usage,
    }));
    return pending ? [...history, pending] : history;
  }, [artifact, pending]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, chatOpen]);

  const activeProvider = providers.find((p) => p.provider_id === providerId);
  const canSend = isNew
    ? Boolean(providerId && semanticModelId && theme && input.trim().length >= 10 && !busy)
    : Boolean(input.trim().length >= 3 && !busy);

  async function send() {
    const instruction = input.trim();
    setPending({ instruction, pending: true });
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
          // The page saved — say what the agent could not answer before they
          // go hunting for a chart that was never possible.
          sessionStorage.setItem(`artifact-warnings-${created.id}`, created.warnings.join("\n"));
        }
        navigate(`/artifacts/${created.id}`, { replace: true });
      } else {
        // No provider_id: the backend reuses the provider that created this
        // artifact, rather than whichever one is listed first.
        await refineArtifact(artifactId!, { instruction });
        await load();
      }
    } catch (e: any) {
      setError(e.message);
      setInput(instruction);   // don't lose what they typed
    } finally {
      setPending(null);
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

  // ── Empty state: the composer is the page ────────────────────────────────
  if (isNew) {
    return (
      <div className="flex h-full flex-col overflow-auto" style={{ background: "var(--bg)" }}>
        <header className="flex shrink-0 items-center gap-2 px-4 py-2.5"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
          <CButton variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => navigate("/artifacts")}>
            <FaArrowLeft size={11} />
          </CButton>
          <p className="text-sm font-bold" style={{ color: "var(--text-h)" }}>New artifact</p>
        </header>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <div className="mb-6 text-center">
              <MdAutoAwesome size={34} style={{ color: "var(--accent)" }} className="mx-auto" />
              <h1 className="mt-3 text-xl font-bold" style={{ color: "var(--text-h)" }}>
                What should this artifact show?
              </h1>
              <p className="mt-1 text-xs" style={{ color: "var(--text)" }}>
                Describe the analysis. The agent reads your semantic model and writes the page —
                charts, narrative and filters.
              </p>
            </div>

            {error && <CAlert variant="error" message={error} className="mb-3" />}
            {providers.length === 0 && (
              <CAlert variant="info" className="mb-3"
                      message="No AI provider configured — add one in AI Providers." />
            )}

            <div className="rounded-2xl border p-3 shadow-sm"
                 style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={5}
                disabled={busy}
                placeholder="e.g. A quarterly sales review: revenue and order KPIs, a monthly trend, a regional breakdown, a written summary of what changed, and filters for date range and region."
                className="w-full resize-none rounded-xl border-0 bg-transparent px-2 py-1 text-sm outline-none"
                style={{ color: "var(--text-h)" }}
              />
              <div className="mt-2 flex flex-wrap items-end gap-2 border-t pt-2"
                   style={{ borderColor: "var(--border)" }}>
                <CSelect
                  value={providerId}
                  onChange={setProviderId}
                  options={providers.map((p) => ({
                    value: p.provider_id, label: p.model ?? `${p.label} (no model set)`,
                  }))}
                  placeholder="Model…"
                  className="!w-48"
                />
                <CSelect
                  value={semanticModelId}
                  onChange={setSemanticModelId}
                  options={semanticModels.map((m) => ({ value: m.id, label: m.name }))}
                  placeholder="Data model…"
                  className="!w-44"
                />
                <CSelect
                  value={theme}
                  onChange={setTheme}
                  options={themes.map((t) => ({ value: t.name, label: t.name }))}
                  placeholder="Theme…"
                  className="!w-36"
                />
                <div className="flex-1" />
                <CButton variant="primary" disabled={!canSend} onClick={send}>
                  {busy ? <CSpinner size={14} /> : <FaMagic size={12} />} Create
                </CButton>
              </div>
            </div>

            {busy && (
              <p className="mt-3 text-center text-xs" style={{ color: "var(--text)" }}>
                Planning, sampling your data, and writing the page — this takes a minute…
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Existing artifact: page behind, chat floating over it ────────────────
  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <header className="flex shrink-0 items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
        <CButton variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => navigate("/artifacts")}>
          <FaArrowLeft size={11} />
        </CButton>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight" style={{ color: "var(--text-h)" }}>
            {artifact?.name ?? "Artifact"}
          </p>
          <p className="truncate text-[11px]" style={{ color: "var(--text)" }}>
            {artifact?.description}
          </p>
        </div>
        {artifact && viewing !== undefined && (
          <span className="ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}>
            viewing v{viewing}
            {viewing !== artifact.current_version ? ` of ${artifact.current_version}` : ""}
          </span>
        )}
        <div className="flex-1" />
        <CButton variant="outline" className="!px-3 !py-1.5 !text-xs" disabled={busy}
                 onClick={() => load(viewing)}>
          <FaSyncAlt size={11} /> Refresh data
        </CButton>
        {!chatOpen && (
          <CButton variant="primary" className="!px-3 !py-1.5 !text-xs" onClick={() => setChatOpen(true)}>
            <FaMagic size={11} /> Prompt
          </CButton>
        )}
      </header>

      {error && <CAlert variant="error" message={error} className="m-3" />}
      {warnings.map((w, i) => (
        <CAlert key={i} variant="warning" message={w} className="mx-3 mt-2" />
      ))}

      <div className="relative flex-1 overflow-hidden">
        {(loading || busy) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center"
               style={{ background: "var(--bg)", opacity: 0.85 }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text)" }}>
              <CSpinner size={16} /> {busy ? "Rewriting the page…" : "Loading…"}
            </div>
          </div>
        )}
        {/* allow-scripts WITHOUT allow-same-origin: generated JS runs on an opaque
            origin, so it cannot touch this app's DOM, storage or session. */}
        <iframe
          title={artifact?.name ?? "Artifact"}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          className="h-full w-full border-0"
        />

        {chatOpen && (
          <div className="absolute bottom-4 right-4 z-20 flex max-h-[72%] w-[380px] flex-col overflow-hidden rounded-2xl border shadow-2xl"
               style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
                 style={{ borderColor: "var(--border)" }}>
              <MdAutoAwesome size={15} style={{ color: "var(--accent)" }} />
              <p className="flex-1 text-xs font-semibold" style={{ color: "var(--text-h)" }}>
                Prompt history
              </p>
              <span className="text-[10px]" style={{ color: "var(--text)" }}>
                {activeProvider?.model ?? artifact?.llm_model}
              </span>
              <button type="button" onClick={() => setChatOpen(false)}
                      className="rounded p-1 transition hover:bg-[var(--bg)]" title="Hide">
                <MdClose size={15} style={{ color: "var(--text)" }} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
              {turns.map((turn, i) => (
                <div key={i} className="mb-3">
                  <div className="ml-6 rounded-xl rounded-br-sm px-3 py-2 text-xs"
                       style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
                    {turn.instruction}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {turn.pending ? (
                      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text)" }}>
                        <CSpinner size={11} /> writing…
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => load(turn.version)}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition"
                          style={{
                            background: viewing === turn.version ? "var(--accent)" : "var(--bg)",
                            color: viewing === turn.version ? "var(--accent-fg)" : "var(--text)",
                            border: "1px solid var(--border)",
                          }}
                          title="View this version"
                        >
                          <FaHistory size={8} /> v{turn.version}
                        </button>
                        {artifact && turn.version !== artifact.current_version && (
                          <button type="button" onClick={() => restore(turn.version!)}
                                  className="text-[10px] underline" style={{ color: "var(--text)" }}>
                            restore
                          </button>
                        )}
                        {turn.at && (
                          <span className="text-[10px]" style={{ color: "var(--text)" }}>
                            {new Date(turn.at).toLocaleString(undefined,
                              { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {turn.usage && (
                          <span className="text-[10px]" style={{ color: "var(--text)" }}
                                title={`${turn.usage.in} in · ${turn.usage.out} out, of which `
                                       + `${turn.usage.reasoning} hidden reasoning tokens`}>
                            · {((turn.usage.in + turn.usage.out) / 1000).toFixed(1)}k tokens
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t p-2" style={{ borderColor: "var(--border)" }}>
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
                  className="flex-1 resize-none rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
                  style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-h)" }}
                />
                <CButton variant="primary" className="!px-2.5 !py-2" disabled={!canSend} onClick={send}>
                  {busy ? <CSpinner size={12} /> : <FaPaperPlane size={11} />}
                </CButton>
              </div>
              <p className="mt-1 px-1 text-[10px]" style={{ color: "var(--text)" }}>
                Enter to send · each prompt creates a new version
              </p>
            </div>
          </div>
        )}

        {!chatOpen && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-2xl transition hover:brightness-105"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <MdChevronRight size={14} /> Prompt · v{artifact?.current_version}
          </button>
        )}
      </div>
    </div>
  );
}
