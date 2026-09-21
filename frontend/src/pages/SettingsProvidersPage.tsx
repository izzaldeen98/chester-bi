import { useEffect, useState } from "react";
import { FaPlus, FaTrash, FaKey, FaPlug, FaSyncAlt } from "react-icons/fa";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CSelect from "../components/CSelect";
import CDialog from "../components/CDialog";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CConfirmDialog from "../components/CConfirmDialog";
import {
  getAIProviders,
  createAIProvider,
  updateAIProvider,
  deleteAIProvider,
  testAIProvider,
  refreshAIProviderModels,
  getKnownModels,
  type AIProviderResponse,
} from "../lib/Api";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "gemini", label: "Google Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "Qwen (Alibaba DashScope)" },
];

// Shown under the Base URL field so the region/proxy case is obvious.
const BASE_URL_HINTS: Record<string, string> = {
  qwen: "Defaults to the international endpoint. For mainland China use https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "Defaults to https://api.deepseek.com/v1",
};

export default function SettingsProvidersPage() {
  const [rows, setRows] = useState<AIProviderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AIProviderResponse | null>(null);
  const [testing, setTesting] = useState("");
  const [syncing, setSyncing] = useState("");

  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [known, setKnown] = useState<Record<string, string[]>>({});

  function refresh() {
    setLoading(true);
    getAIProviders()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);
  useEffect(() => {
    getKnownModels().then(setKnown).catch(() => undefined);
  }, []);
  // Curated ids only until the provider is saved — there is no key to query yet.
  useEffect(() => setDefaultModel(""), [provider]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await createAIProvider({
        provider,
        label: label.trim(),
        api_key: apiKey.trim(),
        default_model: defaultModel,
        base_url: baseUrl.trim() || undefined,
      });
      setDialogOpen(false);
      setLabel("");
      setApiKey("");
      setBaseUrl("");
      setDefaultModel("");
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(row: AIProviderResponse) {
    setTesting(row.id);
    setError("");
    setOk("");
    try {
      const result = await testAIProvider(row.id);
      setOk(`${row.label}: ${result.message}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTesting("");
    }
  }

  async function handleRefreshModels(row: AIProviderResponse) {
    setSyncing(row.id);
    setError("");
    setOk("");
    try {
      const updated = await refreshAIProviderModels(row.id);
      setOk(`${updated.label}: ${updated.models.length} models available.`);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing("");
    }
  }

  async function handleModelChange(row: AIProviderResponse, model: string) {
    try {
      await updateAIProvider(row.id, { default_model: model });
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleToggle(row: AIProviderResponse) {
    try {
      await updateAIProvider(row.id, { is_active: !row.is_active });
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 flex items-center gap-3">
          <FaKey size={18} style={{ color: "var(--accent)" }} />
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text-h)" }}>AI Providers</h1>
            <p className="text-xs" style={{ color: "var(--text)" }}>
              Bring your own API key. Keys are encrypted at rest and never sent back to the browser.
              Pick the model once here — generating and refining never ask again. Use Sync models
              when a provider retires a model id.
            </p>
          </div>
          <CButton variant="primary" onClick={() => setDialogOpen(true)}>
            <FaPlus size={11} /> Add provider
          </CButton>
        </div>

        {error && <CAlert variant="error" message={error} className="mb-3" />}
        {ok && <CAlert variant="success" message={ok} className="mb-3" />}

        {loading ? (
          <div className="flex justify-center py-16"><CSpinner /></div>
        ) : rows.length === 0 ? (
          <CAlert variant="info" message="No providers yet — add one to enable the AI Dashboard Builder." />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-4 rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--text-h)" }}>
                    {row.label}
                    {!row.is_active && (
                      <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text)" }}>
                        (disabled)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "var(--text)" }}>
                    {row.provider} · {row.api_key_hint}
                    {row.base_url ? ` · ${row.base_url}` : ""}
                  </p>
                </div>
                <div className="w-56 shrink-0">
                  <CSelect
                    value={row.default_model ?? ""}
                    onChange={(m) => handleModelChange(row, m)}
                    options={row.models.map((m) => ({ value: m, label: m }))}
                    placeholder="Pick a model…"
                  />
                </div>
                <CButton variant="ghost" className="!px-2 !py-1 !text-xs"
                         disabled={syncing === row.id}
                         onClick={() => handleRefreshModels(row)}>
                  {syncing === row.id ? <CSpinner size={12} /> : <FaSyncAlt size={11} />} Sync models
                </CButton>
                <CButton variant="ghost" className="!px-2 !py-1 !text-xs"
                         disabled={testing === row.id || !row.default_model}
                         onClick={() => handleTest(row)}>
                  {testing === row.id ? <CSpinner size={12} /> : <FaPlug size={11} />} Test
                </CButton>
                <CButton variant="outline" className="!px-2 !py-1 !text-xs" onClick={() => handleToggle(row)}>
                  {row.is_active ? "Disable" : "Enable"}
                </CButton>
                <CButton variant="danger" className="!px-2 !py-1 !text-xs" onClick={() => setDeleting(row)}>
                  <FaTrash size={11} />
                </CButton>
              </div>
            ))}
          </div>
        )}
      </div>

      <CDialog
        isOpen={dialogOpen}
        title="Add AI provider"
        subtitle="The key is encrypted with the server's FERNET_KEY and decrypted only when a request is made."
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        saving={saving}
        saveDisabled={!label.trim() || apiKey.trim().length < 8 || !defaultModel}
        saveLabel="Add provider"
      >
        <div className="flex flex-col gap-3">
          <CSelect label="Provider" value={provider} onChange={setProvider} options={PROVIDERS} required />
          <CTextInput label="Label" value={label} onChange={setLabel}
                      placeholder="e.g. Team OpenAI key" required />
          <CTextInput label="API key" type="password" value={apiKey} onChange={setApiKey}
                      placeholder="sk-…" required autoComplete="off" />
          <CSelect label="Model" value={defaultModel} onChange={setDefaultModel}
                   options={(known[provider] ?? []).map((m) => ({ value: m, label: m }))}
                   placeholder="Pick the model to use…" required />
          <p className="-mt-1 text-[11px]" style={{ color: "var(--text)" }}>
            Every prompt uses this model. After saving, Sync models pulls the live list from the
            provider and you can change it here.
          </p>
          <CTextInput label="Base URL (optional)" value={baseUrl} onChange={setBaseUrl}
                      placeholder="https://my-proxy.internal/v1" />
          {BASE_URL_HINTS[provider] && (
            <p className="-mt-1 text-[11px]" style={{ color: "var(--text)" }}>
              {BASE_URL_HINTS[provider]}
            </p>
          )}
        </div>
      </CDialog>

      <CConfirmDialog
        isOpen={Boolean(deleting)}
        title="Delete provider"
        message={`Delete "${deleting?.label}"? Dashboards already generated are unaffected.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteAIProvider(deleting.id);
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
