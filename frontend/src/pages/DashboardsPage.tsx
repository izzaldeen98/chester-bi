import { useEffect, useState } from "react";
import { MdDashboard } from "react-icons/md";
import { FaSearch, FaEdit, FaTrash, FaPlus, FaCalendarAlt, FaSyncAlt, FaFileCode } from "react-icons/fa";
import CMetricCard from "../components/CMetricCard";
import CHCard from "../components/CHCard";
import CInfoSideBar from "../components/CInfoSideBar";
import CConfirmDialog from "../components/CConfirmDialog";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CDetailRow from "../components/CDetailRow";
import {
  getDashboards,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  type DashboardPublicResponse,
} from "../lib/Api";

type SidebarMode = "view" | "edit" | "create";

// ── Helpers ────────────────────────────────────────────────────────────────
function getDashboardInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ── Textarea ───────────────────────────────────────────────────────────────
function CTextArea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
          {label}
          {required && <span className="ml-0.5 text-[var(--accent)]">*</span>}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="w-full resize-none rounded-xl border bg-[var(--bg)] px-3.5 py-2.5 text-sm
          text-[var(--text-h)] placeholder:text-[var(--text)]
          outline-none transition-all
          focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]
          border-[var(--border)]"
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardsPage() {
  // Data
  const [dashboards, setDashboards] = useState<DashboardPublicResponse[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState("");
  const [search, setSearch]         = useState("");

  // Sidebar
  const [mode, setMode]           = useState<SidebarMode>("view");
  const [selected, setSelected]   = useState<DashboardPublicResponse | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  // Edit fields
  const [fName,        setFName]        = useState("");
  const [fDescription, setFDescription] = useState("");

  // Create fields
  const [cName,        setCName]        = useState("");
  const [cDescription, setCDescription] = useState("");

  // Delete confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => { fetchDashboards(); }, []);

  async function fetchDashboards() {
    setLoading(true);
    setPageError("");
    try {
      setDashboards(await getDashboards());
    } catch (e: any) {
      setPageError(e.message ?? "Failed to load dashboards.");
    } finally {
      setLoading(false);
    }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────
  const total        = dashboards.length;
  const thisMonth    = dashboards.filter((d) => isThisMonth(d.created_at)).length;
  const updatedToday = dashboards.filter((d) => isToday(d.updated_at)).length;
  const withConfig   = dashboards.filter((d) => !!d.config_file).length;

  // ── Search ───────────────────────────────────────────────────────────────
  const filtered = dashboards.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  });

  // ── Open modes ───────────────────────────────────────────────────────────
  const isSidebarOpen = mode === "create" || !!selected;

  function openView(d: DashboardPublicResponse) {
    setSelected(d); setMode("view"); setFormError("");
  }

  function openEdit(d: DashboardPublicResponse) {
    setSelected(d);
    setFName(d.name);
    setFDescription(d.description);
    setFormError(""); setMode("edit");
  }

  function openCreate() {
    setSelected(null);
    setCName(""); setCDescription("");
    setFormError(""); setMode("create");
  }

  function closePanel() {
    setSelected(null); setMode("view"); setFormError("");
  }

  // ── Save edit ────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!selected) return;
    if (!fName.trim()) { setFormError("Name is required."); return; }
    setSaving(true); setFormError("");
    try {
      await updateDashboard(selected.id, {
        name: fName,
        description: fDescription || undefined,
      });
      await fetchDashboards();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Update failed.");
    } finally { setSaving(false); }
  }

  // ── Save create ──────────────────────────────────────────────────────────
  async function saveCreate() {
    if (!cName.trim() || !cDescription.trim()) {
      setFormError("Name and description are required."); return;
    }
    setSaving(true); setFormError("");
    try {
      await createDashboard({ name: cName, description: cDescription });
      await fetchDashboards();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Create failed.");
    } finally { setSaving(false); }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected) return;
    setDeleting(true); setDeleteError("");
    try {
      await deleteDashboard(selected.id);
      await fetchDashboards();
      setConfirmOpen(false);
      closePanel();
    } catch (e: any) {
      setDeleteError(e.message ?? "Delete failed.");
      setConfirmOpen(false);
    } finally { setDeleting(false); }
  }

  // ── Sidebar content ──────────────────────────────────────────────────────
  function renderSidebarContent() {
    if (mode === "create") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}
          <CTextInput label="Name"        value={cName}        onChange={setCName}        placeholder="e.g. Sales Overview" required />
          <CTextArea  label="Description" value={cDescription} onChange={setCDescription} placeholder="What does this dashboard show?" required rows={4} />
        </div>
      );
    }

    if (!selected) return null;

    if (mode === "edit") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}
          <CTextInput label="Name"        value={fName}        onChange={setFName}        required />
          <CTextArea  label="Description" value={fDescription} onChange={setFDescription} rows={4} />
        </div>
      );
    }

    // view
    return (
      <div>
        <div className="mb-6 flex flex-col items-center gap-2">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
          >
            {getDashboardInitials(selected.name)}
          </div>
          <p className="text-base font-bold text-center" style={{ color: "var(--text-h)" }}>
            {selected.name}
          </p>
        </div>
        <CDetailRow label="Description"  value={selected.description} />
        <CDetailRow label="Config File"  value={selected.config_file} />
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
          <CButton variant="primary" fullWidth loading={saving} onClick={saveCreate} disabled={!cName.trim() || !cDescription.trim()}>
            Create Dashboard
          </CButton>
          <CButton variant="ghost" onClick={closePanel} disabled={saving}>Cancel</CButton>
        </div>
      );
    }
    if (mode === "edit") {
      return (
        <div className="flex gap-2">
          <CButton variant="primary" fullWidth loading={saving} onClick={saveEdit}>Save Changes</CButton>
          <CButton variant="ghost" onClick={() => selected && openView(selected)} disabled={saving}>Cancel</CButton>
        </div>
      );
    }
    if (!selected) return null;
    return (
      <div className="flex flex-col gap-2">
        {deleteError && <CAlert variant="error" message={deleteError} />}
        <CButton variant="primary" fullWidth onClick={() => openEdit(selected)}>
          <MdDashboard size={14} /> View Dashboard
        </CButton>
        <CButton variant="outline" fullWidth onClick={() => openEdit(selected)}>
          <FaEdit size={14} /> Edit Dashboard
        </CButton>
        <CButton
          variant="danger"
          fullWidth
          onClick={() => { setDeleteError(""); setConfirmOpen(true); }}
        >
          <FaTrash size={13} /> Delete Dashboard
        </CButton>
      </div>
    );
  }

  // ── Sidebar meta ─────────────────────────────────────────────────────────
  const sidebarTitle =
    mode === "create" ? "New Dashboard" :
    mode === "edit"   ? "Edit Dashboard" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "Fill in the details below" :
    mode === "edit"   ? "Update name or description" :
    selected ? `Created by ${selected.created_by}` : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>Dashboards</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            Create and manage your data dashboards.
          </p>
        </div>
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> New Dashboard
        </CButton>
      </div>

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}

      {/* Metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CMetricCard label="Total"          value={total}        icon={<MdDashboard size={18} />} />
        <CMetricCard label="Created This Month" value={thisMonth}    icon={<FaCalendarAlt size={16} />} trend="new this month" up={thisMonth > 0} />
        <CMetricCard label="Updated Today"  value={updatedToday} icon={<FaSyncAlt size={16} />}   trend={updatedToday > 0 ? "recently changed" : "no changes today"} up={updatedToday > 0} />
        <CMetricCard label="With Config"    value={withConfig}   icon={<FaFileCode size={16} />} />
      </div>

      {/* Search */}
      <div className="mb-5 max-w-sm">
        <CTextInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or description…"
          icon={<FaSearch size={13} />}
        />
      </div>

      {/* Dashboard grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <CSpinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MdDashboard size={36} style={{ color: "var(--border)" }} />
          <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
            {search ? "No dashboards match your search." : "No dashboards yet — create one above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <CHCard
              key={d.id}
              title={d.name}
              subtitle={d.description}
              meta={`By ${d.created_by}`}
              initials={getDashboardInitials(d.name)}
              isSelected={selected?.id === d.id && mode !== "create"}
              onClick={() => openView(d)}
            />
          ))}
        </div>
      )}

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
        title="Delete Dashboard"
        message={
          selected
            ? `Are you sure you want to delete "${selected.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
