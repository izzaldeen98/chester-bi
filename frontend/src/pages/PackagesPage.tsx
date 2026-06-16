import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoPackage } from "react-icons/go";
import { FaSearch, FaPlus, FaCalendarAlt, FaCheckCircle, FaFolderOpen, FaCode } from "react-icons/fa";
import { MdBlock } from "react-icons/md";
import CMetricCard from "../components/CMetricCard";
import CHCard from "../components/CHCard";
import CInfoSideBar from "../components/CInfoSideBar";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CDetailRow from "../components/CDetailRow";
import { getPackages, createPackage, type PackageResponse } from "../lib/Api";

type SidebarMode = "view" | "create";

// ── Helpers ────────────────────────────────────────────────────────────────
function getPackageInitials(name: string) {
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
        <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
export default function PackagesPage() {
  const navigate = useNavigate();

  // Data
  const [packages, setPackages]   = useState<PackageResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch]       = useState("");

  // Sidebar
  const [mode, setMode]           = useState<SidebarMode>("view");
  const [selected, setSelected]   = useState<PackageResponse | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  // Create fields
  const [cName,        setCName]        = useState("");
  const [cDescription, setCDescription] = useState("");

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => { fetchPackages(); }, []);

  async function fetchPackages() {
    setLoading(true);
    setPageError("");
    try {
      setPackages(await getPackages());
    } catch (e: any) {
      setPageError(e.message ?? "Failed to load packages.");
    } finally {
      setLoading(false);
    }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────
  const total     = packages.length;
  const active    = packages.filter((p) => p.is_active).length;
  const inactive  = total - active;
  const thisMonth = packages.filter((p) => isThisMonth(p.created_at)).length;

  // ── Search ───────────────────────────────────────────────────────────────
  const filtered = packages.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
  });

  // ── Open modes ───────────────────────────────────────────────────────────
  const isSidebarOpen = mode === "create" || !!selected;

  function openView(p: PackageResponse) {
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

  // ── Save create ──────────────────────────────────────────────────────────
  async function saveCreate() {
    if (!cName.trim()) { setFormError("Name is required."); return; }
    setSaving(true); setFormError("");
    try {
      await createPackage(cName, cDescription || undefined);
      await fetchPackages();
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
          <CTextArea  label="Description" value={cDescription} onChange={setCDescription} placeholder="What does this package contain?" rows={4} />
        </div>
      );
    }

    if (!selected) return null;

    // view
    return (
      <div>
        <div className="mb-6 flex flex-col items-center gap-2">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
          >
            {getPackageInitials(selected.name)}
          </div>
          <p className="text-base font-bold text-center" style={{ color: "var(--text-h)" }}>
            {selected.name}
          </p>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-medium ${
              selected.is_active
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
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
            Create Package
          </CButton>
          <CButton variant="ghost" onClick={closePanel} disabled={saving}>Cancel</CButton>
        </div>
      );
    }
    // view
    if (selected) {
      return (
        <CButton variant="outline" fullWidth onClick={() => navigate(`/packages/${selected.id}/editor`)}>
          <FaCode size={13} /> Open Editor
        </CButton>
      );
    }
    return null;
  }

  // ── Sidebar meta ─────────────────────────────────────────────────────────
  const sidebarTitle =
    mode === "create" ? "New Package" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "Fill in the details below" :
    selected ? `Created by ${selected.created_by}` : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>Packages</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            Manage analytics packages and their models.
          </p>
        </div>
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> New Package
        </CButton>
      </div>

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}

      {/* Metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CMetricCard label="Total"            value={total}     icon={<GoPackage size={18} />} />
        <CMetricCard label="Active"           value={active}    icon={<FaCheckCircle size={16} />} trend="currently active" up={active > 0} />
        <CMetricCard label="Inactive"         value={inactive}  icon={<MdBlock size={18} />}   trend={inactive === 0 ? "all good" : "need attention"} up={inactive === 0} />
        <CMetricCard label="Created This Month" value={thisMonth} icon={<FaCalendarAlt size={16} />} trend="new this month" up={thisMonth > 0} />
      </div>

      {/* Search */}
      <div className="mb-5 max-w-sm">
        <CTextInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or location…"
          icon={<FaSearch size={13} />}
        />
      </div>

      {/* Package grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <CSpinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FaFolderOpen size={36} style={{ color: "var(--border)" }} />
          <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
            {search ? "No packages match your search." : "No packages yet — create one above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <CHCard
              key={p.id}
              title={p.name}
              subtitle={p.location}
              meta={`By ${p.created_by}`}
              initials={getPackageInitials(p.name)}
              isSelected={selected?.id === p.id && mode !== "create"}
              badge={{ label: p.is_active ? "Active" : "Inactive", variant: p.is_active ? "green" : "red" }}
              onClick={() => openView(p)}
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
    </div>
  );
}
