import { useEffect, useState } from "react";
import { FaMagic } from "react-icons/fa";
import CDialog from "./CDialog";
import CAlert from "./CAlert";
import {
  getAIModels,
  promptDashboardElement,
  type AIModelOption,
  type DashboardElement,
} from "../lib/Api";

interface Props {
  isOpen: boolean;
  dashboardId?: string;
  elementId: string;
  elementTitle: string;
  onClose: () => void;
  /** Fires only when the backend validated AND saved the change. */
  onApplied: (element: DashboardElement) => void;
}

/** Chat affordance scoped to one component. The backend re-reads the element
 *  from the saved config, validates the model's answer against Cube meta, and
 *  saves it — so a change either lands everywhere or nowhere. */
export default function ComponentPromptDialog({
  isOpen,
  dashboardId,
  elementId,
  elementTitle,
  onClose,
  onApplied,
}: Props) {
  const [providers, setProviders] = useState<AIModelOption[]>([]);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    getAIModels().then(setProviders).catch((e) => setError(e.message));
  }, [isOpen]);

  // One provider: the backend resolves it. Several: name the first.
  const providerId = providers.length === 1 ? undefined : providers[0]?.provider_id;
  const using = providers.length === 1 ? providers[0] : providers[0];

  async function send() {
    if (!dashboardId) {
      setError("Save the dashboard once before prompting a component.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await promptDashboardElement(dashboardId, elementId, {
        provider_id: providerId,
        instruction: instruction.trim(),
      });
      if (!result.saved) {
        setError(result.errors.join(" · ") || "The model could not make that change.");
        return;
      }
      onApplied(result.element);
      setInstruction("");
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CDialog
      isOpen={isOpen}
      title={`Prompt: ${elementTitle}`}
      subtitle="Describe the change. Only this component is affected."
      onClose={onClose}
      onSave={send}
      saving={busy}
      saveDisabled={instruction.trim().length < 3}
      saveLabel="Apply change"
    >
      <div className="flex flex-col gap-3">
        {error && <CAlert variant="error" message={error} />}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-h)" }}>
            Change request
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={4}
            placeholder="e.g. make this a bar chart, or colour the series by the theme accent"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-h)" }}
          />
        </div>
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text)" }}>
          <FaMagic size={10} /> {using ? `${using.label} — ${using.model ?? "no model set"} · ` : ""}
          validated against your semantic model before saving.
        </p>
      </div>
    </CDialog>
  );
}
