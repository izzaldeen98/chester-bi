import { useEffect, useState } from "react";
import { FaPlus, FaTrash, FaPlug, FaSyncAlt } from "react-icons/fa";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CSelect from "../components/CSelect";
import CDialog from "../components/CDialog";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import { BoardFill, BoardHead, EmptyBoard, Panel, Status } from "../components/Board";
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header
        className="flex shrink-0 flex-wrap items-center gap-4 px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-none tracking-[-0.02em]">AI Providers</h1>
          <p className="mt-1.5 text-[13px] leading-none" style={{ color: "var(--text-3)" }}>
            Bring your own key · encrypted at rest · model chosen once
          </p>
        </div>
        <div className="ml-auto">
          <CButton variant="primary" onClick={() => setDialogOpen(true)}>
            <FaPlus size={10} /> Add provider
          </CButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {error && <CAlert variant="error" message={error} />}
        {ok && <CAlert variant="success" message={ok} />}

        <Panel label="Providers" flush bodyClassName="flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20" style={{ color: "var(--text-3)" }}>
              <CSpinner size={18} />
              <span className=" text-[12px]">Loading…</span>
            </div>
          ) : rows.length === 0 ? (
            <EmptyBoard
              line="No AI provider yet"
              hint="Add a provider and your own API key. Artifacts cannot be built until one is connected."
              action={
                <CButton variant="primary" onClick={() => setDialogOpen(true)}>
                  <FaPlus size={10} /> Add provider
                </CButton>
              }
            />
          ) : (
            <>
              <BoardHead cols="minmax(0,1fr) 210px 150px 250px">
                <span className="label">Provider</span>
                <span className="label">Model in use</span>
                <span className="label">State</span>
                <span className="label text-right"></span>
              </BoardHead>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center gap-3 px-3 py-2.5"
                  style={{
                    gridTemplateColumns: "minmax(0,1fr) 210px 150px 250px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span className="min-w-0">
                    <span className="font-medium block truncate text-[14px] leading-tight">{row.label}</span>
                    <span className="mono mt-0.5 block truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                      {row.provider} · {row.api_key_hint}
                      {row.base_url ? ` · ${row.base_url}` : ""}
                    </span>
                  </span>

                  <CSelect
                    value={row.default_model ?? ""}
                    onChange={(m) => handleModelChange(row, m)}
                    options={row.models.map((m) => ({ value: m, label: m }))}
                    placeholder="PICK A MODEL…"
                  />

                  <Status signal={row.is_active ? "ok" : "idle"}>
                    {row.is_active ? "Active" : "Paused"}
                  </Status>

                  <span className="flex items-center justify-end gap-1">
                    <CButton variant="ghost" className="!px-2 !py-1" disabled={syncing === row.id}
                             onClick={() => handleRefreshModels(row)}>
                      {syncing === row.id ? <CSpinner size={12} /> : <FaSyncAlt size={10} />} Sync
                    </CButton>
                    <CButton variant="ghost" className="!px-2 !py-1"
                             disabled={testing === row.id || !row.default_model}
                             onClick={() => handleTest(row)}>
                      {testing === row.id ? <CSpinner size={12} /> : <FaPlug size={10} />} Test
                    </CButton>
                    <CButton variant="outline" className="!px-2 !py-1" onClick={() => handleToggle(row)}>
                      {row.is_active ? "Stop" : "Start"}
                    </CButton>
                    <CButton variant="danger" className="!px-2 !py-1" onClick={() => setDeleting(row)}>
                      <FaTrash size={10} />
                    </CButton>
                  </span>
                </div>
              ))}
              <BoardFill />
            </>
          )}
        </Panel>
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
          <p className="-mt-1 text-[11px]" style={{ color: "var(--text-2)" }}>
            Every prompt uses this model. After saving, Sync models pulls the live list from the
            provider and you can change it here.
          </p>
          <CTextInput label="Base URL (optional)" value={baseUrl} onChange={setBaseUrl}
                      placeholder="https://my-proxy.internal/v1" />
          {BASE_URL_HINTS[provider] && (
            <p className="-mt-1 text-[11px]" style={{ color: "var(--text-2)" }}>
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
