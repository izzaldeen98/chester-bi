import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaPlus, FaCode, FaTrash } from "react-icons/fa";
import CHCard from "../components/CHCard";
import { BoardFill, BoardHead, EmptyBoard, Panel } from "../components/Board";
import CInfoSideBar from "../components/CInfoSideBar";
import CConfirmDialog from "../components/CConfirmDialog";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CDetailRow from "../components/CDetailRow";
import { getModels, createModel, deleteModel, type ModelResponse } from "../lib/Api";

type SidebarMode = "view" | "create";

// ── Helpers ────────────────────────────────────────────────────────────────
function getModelInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}


// ── Textarea ───────────────────────────────────────────────────────────────
function CTextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium" style={{ color: "var(--text)" }}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-[var(--r-sm)] border bg-[var(--surface)] px-3.5 py-2.5 text-sm
          text-[var(--text)] placeholder:text-[var(--text-2)]
          outline-none transition-all
          focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]
          border-[var(--border)]"
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ModelsPage() {
  const navigate = useNavigate();

  // Data
  const [models, setModels]       = useState<ModelResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch]       = useState("");

  // Sidebar
  const [mode, setMode]           = useState<SidebarMode>("view");
  const [selected, setSelected]   = useState<ModelResponse | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Create fields
  const [cName,        setCName]        = useState("");
  const [cDescription, setCDescription] = useState("");

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => { fetchModels(); }, []);

  async function fetchModels() {
    setLoading(true);
    setPageError("");
    try {
      setModels(await getModels());
    } catch (e: any) {
      setPageError(e.message ?? "Failed to load models.");
    } finally {
      setLoading(false);
    }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────

  // ── Search ───────────────────────────────────────────────────────────────
  const filtered = models.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
  });

  // ── Open modes ───────────────────────────────────────────────────────────
  const isSidebarOpen = mode === "create" || !!selected;

  function openView(p: ModelResponse) {
    setSelected(p); setMode("view"); setFormError("");
  }

  function openCreate() {
    setSelected(null);
    setCName(""); setCDescription("");
    setFormError(""); setMode("create");
  }

  function closePanel() {
    setSelected(null); setMode("view"); setFormError("");
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected) return;
    setDeleting(true); setDeleteError("");
    try {
      await deleteModel(selected.id);
      await fetchModels();
      setConfirmOpen(false); closePanel();
    } catch (e: any) {
      setDeleteError(e.message ?? "Delete failed."); setConfirmOpen(false);
    } finally { setDeleting(false); }
  }

  // ── Save create ──────────────────────────────────────────────────────────
  async function saveCreate() {
    if (!cName.trim()) { setFormError("Name is required."); return; }
    setSaving(true); setFormError("");
    try {
      await createModel(cName, cDescription || undefined);
      await fetchModels();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Create failed.");
    } finally { setSaving(false); }
  }

  // ── Sidebar content ──────────────────────────────────────────────────────
  function renderSidebarContent() {
    if (mode === "create") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}
          <CTextInput label="Name"        value={cName}        onChange={setCName}        placeholder="e.g. sales-analytics" required />
          <CTextArea  label="Description" value={cDescription} onChange={setCDescription} placeholder="What does this model contain?" rows={4} />
        </div>
      );
    }

    if (!selected) return null;

    // view
    return (
      <div>
        <div className="mb-6 flex flex-col items-center gap-2">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-[var(--r-sm)] text-xl font-bold"
            style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-line)" }}
          >
            {getModelInitials(selected.name)}
          </div>
          <p className="text-base font-bold text-center" style={{ color: "var(--text)" }}>
            {selected.name}
          </p>
          <span
            className={`rounded-[var(--r-sm)] px-3 py-0.5 text-xs font-medium ${
              selected.is_active
                ? "text-[var(--ok)] bg-[var(--ok-soft)]"
                : "text-[var(--danger)] bg-[var(--danger-soft)]"
            }`}
          >
            {selected.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <CDetailRow label="Location"     value={selected.location} />
        <CDetailRow label="Created"      value={formatDate(selected.created_at)} />
        <CDetailRow label="Last Updated" value={formatDate(selected.updated_at)} />
        <CDetailRow label="Created By"   value={selected.created_by} />
        <CDetailRow label="Updated By"   value={selected.updated_by} />
      </div>
    );
  }

  function renderSidebarFooter() {
    if (mode === "create") {
      return (
        <div className="flex gap-2">
          <CButton variant="primary" fullWidth loading={saving} onClick={saveCreate} disabled={!cName.trim()}>
            Create Model
          </CButton>
          <CButton variant="ghost" onClick={closePanel} disabled={saving}>Cancel</CButton>
        </div>
      );
    }
    // view
    if (selected) {
      return (
        <div className="flex flex-col gap-2">
          {deleteError && <CAlert variant="error" message={deleteError} />}
          <CButton variant="outline" fullWidth onClick={() => navigate(`/models/${selected.id}/editor`)}>
            <FaCode size={13} /> Open Editor
          </CButton>
          <CButton variant="danger" fullWidth onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>
            <FaTrash size={13} /> Delete Model
          </CButton>
        </div>
      );
    }
    return null;
  }

  // ── Sidebar meta ─────────────────────────────────────────────────────────
  const sidebarTitle =
    mode === "create" ? "New Model" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "Fill in the details below" :
    selected ? `Created by ${selected.created_by}` : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header
        className="flex shrink-0 flex-wrap items-center gap-4 px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-none tracking-[-0.02em]">Models</h1>
          <p className="mt-1.5 text-[13px] leading-none" style={{ color: "var(--text-3)" }}>Manage analytics models and their definitions.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> New Model
        </CButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}


      {/* Search */}
      <div className="mb-5 max-w-sm">
        <CTextInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or location…"
          icon={<FaSearch size={13} />}
        />
      </div>

      {/* Model grid */}
      <Panel label="Models" flush bodyClassName="flex flex-col">
        {loading ? (
        <div className="flex items-center justify-center py-20">
          <CSpinner size={28} />
        </div>
        ) : filtered.length === 0 ? (
        <EmptyBoard line={search ? "No match on this board" : "No models defined"} hint={search ? "Try a different search." : "A semantic model is the contract: it decides what an artifact can be asked."} />
        ) : (
          <>
          <BoardHead cols="42px minmax(0,1fr) 140px 108px">
            <span className="label"></span>
            <span className="label">Model</span>
            <span className="label">Location</span>
            <span className="label text-right">State</span>
          </BoardHead>
          {filtered.map((p) => (
            <CHCard
              key={p.id}
              title={p.name}
              subtitle={p.location}
              meta={`By ${p.created_by}`}
              initials={getModelInitials(p.name)}
              isSelected={selected?.id === p.id && mode !== "create"}
              badge={{ label: p.is_active ? "Active" : "Inactive", variant: p.is_active ? "green" : "red" }}
              onClick={() => openView(p)}
            />
          ))}
          <BoardFill />
          </>
        )}
      </Panel>

      {/* Sidebar */}
      <CInfoSideBar
        isOpen={isSidebarOpen}
        onClose={closePanel}
        title={sidebarTitle}
        subtitle={sidebarSubtitle}
        footer={renderSidebarFooter()}
      >
        {renderSidebarContent()}
      </CInfoSideBar>

      {/* Delete confirmation */}
      <CConfirmDialog
        isOpen={confirmOpen}
        title="Delete Model"
        message={selected ? `Are you sure you want to delete "${selected.name}"? This will also delete all its definitions and datasets. This action cannot be undone.` : ""}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
    </div>  );
}
