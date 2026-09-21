import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaMagic, FaCog } from "react-icons/fa";
import CButton from "../components/CButton";
import CSelect from "../components/CSelect";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import {
  getAIModels,
  getAIThemes,
  getModels,
  generateAIDashboard,
  type AIModelOption,
  type AITheme,
  type ModelResponse,
} from "../lib/Api";

export default function AIBuilderPage() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<AIModelOption[]>([]);
  const [themes, setThemes] = useState<AITheme[]>([]);
  const [semanticModels, setSemanticModels] = useState<ModelResponse[]>([]);
  const [providerId, setProviderId] = useState("");
  const [semanticModelId, setSemanticModelId] = useState("");
  const [theme, setTheme] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([getAIModels(), getAIThemes(), getModels()])
      .then(([m, t, sm]) => {
        setProviders(m);
        if (m.length === 1) setProviderId(m[0].provider_id);
        setThemes(t);
        setSemanticModels(sm.filter((s) => s.is_active));
      })
      .catch((e) => setError(e.message));
  }, []);

  const active = useMemo(
    () => providers.find((p) => p.provider_id === providerId),
    [providers, providerId],
  );

  const themeColors = themes.find((t) => t.name === theme)?.colors ?? [];
  const canGenerate = Boolean(providerId && semanticModelId && theme && brief.trim().length >= 10);

  async function handleGenerate() {
    setBusy(true);
    setError("");
    setNotes([]);
    try {
      const result = await generateAIDashboard({
        provider_id: providerId,
        semantic_model_id: semanticModelId,
        theme,
        brief: brief.trim(),
      });
      const messages = [
        ...result.unmet.map((u) => `Not covered by any dataset: ${u}`),
        ...result.errors.map((e) => `Component dropped: ${e}`),
      ];
      if (messages.length) {
        // Something was dropped — show it before navigating away, the user
        // decides whether to open the partial dashboard or re-brief.
        setNotes([`Built "${result.name}" with ${result.element_count} components.`, ...messages]);
        setBusy(false);
        setTimeout(() => navigate(`/workspace/${result.dashboard_id}`), 4000);
        return;
      }
      navigate(`/workspace/${result.dashboard_id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <FaMagic size={20} style={{ color: "var(--accent)" }} />
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-h)" }}>
              AI Dashboard Builder
            </h1>
            <p className="text-xs" style={{ color: "var(--text)" }}>
              Pick a model to read and describe the dashboard you want. Charts are built from
              that model's saved datasets.
            </p>
          </div>
        </div>

        {error && <CAlert variant="error" message={error} className="mb-4" />}
        {notes.map((n, i) => (
          <CAlert key={i} variant={i === 0 ? "success" : "warning"} message={n} className="mb-2" />
        ))}

        {providers.length === 0 && !error && (
          <CAlert
            variant="info"
            message="No AI providers configured yet — add one in Settings > AI Providers."
            className="mb-4"
          />
        )}

        {semanticModels.length === 0 && !error && (
          <CAlert
            variant="info"
            message="No semantic models yet — define one under Models before generating a dashboard."
            className="mb-4"
          />
        )}

        <div className="flex flex-col gap-4 rounded-xl border p-5"
             style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}>
          {providers.length > 1 ? (
            <CSelect
              label="AI provider"
              value={providerId}
              onChange={setProviderId}
              options={providers.map((p) => ({
                value: p.provider_id, label: `${p.label} — ${p.model ?? "no model set"}`,
              }))}
              placeholder="Choose which provider to use…"
              required
            />
          ) : (
            active && (
              <p className="text-xs" style={{ color: "var(--text)" }}>
                Using <span className="font-semibold" style={{ color: "var(--text-h)" }}>
                  {active.label} — {active.model ?? "no model set"}
                </span>{" "}
                · change it in AI Providers
              </p>
            )
          )}

          <CSelect
            label="Semantic model"
            value={semanticModelId}
            onChange={setSemanticModelId}
            options={semanticModels.map((m) => ({ value: m.id, label: m.name }))}
            placeholder="Choose the model the agent should read…"
            required
          />

          <div>
            <CSelect
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={themes.map((t) => ({ value: t.name, label: t.name }))}
              placeholder="Choose a color theme…"
              required
            />
            {themeColors.length > 0 && (
              <div className="mt-2 flex gap-1.5">
                {themeColors.map((c) => (
                  <span key={c} className="h-5 w-5 rounded" style={{ background: c }} title={c} />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-h)" }}>
              What should this dashboard show? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={7}
              placeholder={
                "e.g. A sales overview for the leadership team: headline KPIs for revenue, " +
                "orders and return rate, revenue trend by month, revenue split by region, " +
                "and a table of the top products. Add a date filter across everything."
              }
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
              style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-h)" }}
            />
          </div>

          <div className="flex items-center gap-3">
            <CButton variant="primary" disabled={!canGenerate || busy} onClick={handleGenerate}>
              {busy ? <CSpinner size={14} /> : <FaMagic size={12} />} Generate dashboard
            </CButton>
            <CButton variant="ghost" onClick={() => navigate("/settings/ai-providers")}>
              <FaCog size={12} /> AI providers
            </CButton>
            {busy && (
              <span className="text-xs" style={{ color: "var(--text)" }}>
                Planning, validating against your semantic model, and saving…
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
