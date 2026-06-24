import { useEffect, useState } from "react";
import { PiFileSqlFill } from "react-icons/pi";
import { FaSearch, FaEdit, FaTrash, FaPlus, FaCalendarAlt, FaSyncAlt, FaDatabase } from "react-icons/fa";
import CMetricCard from "../components/CMetricCard";
import CInfoSideBar from "../components/CInfoSideBar";
import CConfirmDialog from "../components/CConfirmDialog";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CDetailRow from "../components/CDetailRow";
import {
  getQueries,
  getQuery,
  deleteQuery,
  type QueryPublicResponse,
  type QueryDetailedResponse,
} from "../lib/Api";

const columns = ["#","Name", "Package", "Model", "Source" , "Created At", "Created By"];

// ── Helpers ────────────────────────────────────────────────────────────────
function getQueryInitials(name: string) {
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

function openQueryEditor(queryId: string) {
  window.open(`/queries/${queryId}/edit`, "_blank", "noopener,noreferrer");
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function QueriesPage() {
  // Data
  const [queries, setQueries]       = useState<QueryPublicResponse[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState("");
  const [search, setSearch]         = useState("");

  // Sidebar
  const [selected, setSelected]   = useState<QueryPublicResponse | null>(null);
  const [details, setDetails]     = useState<QueryDetailedResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => { fetchQueries(); }, []);

  async function fetchQueries() {
    setLoading(true);
    setPageError("");
    try {
      setQueries(await getQueries());
    } catch (e: any) {
      const msg = e.message ?? "Failed to load queries.";
      if (msg.toLowerCase().includes("no queries found")) {
        setQueries([]);
      } else {
        setPageError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchDetails(queryId: string) {
    setDetailsLoading(true);
    setDetails(null);
    try {
      setDetails(await getQuery(queryId));
    } catch (e: any) {
      setFormError(e.message ?? "Failed to load query details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────
  const total        = queries.length;
  const thisMonth    = queries.filter((q) => isThisMonth(q.created_at)).length;
  const updatedToday = queries.filter((q) => isToday(q.updated_at)).length;
  const modelCount   = new Set(queries.map((q) => q.semantic_model.id)).size;

  // ── Search ───────────────────────────────────────────────────────────────
  const filtered = queries.filter((q) => {
    const term = search.toLowerCase();
    return (
      q.name.toLowerCase().includes(term) ||
      q.source.toLowerCase().includes(term) ||
      q.semantic_model.name.toLowerCase().includes(term) ||
      q.semantic_model.package.name.toLowerCase().includes(term)
    );
  });

  const isSidebarOpen = !!selected;

  function openView(q: QueryPublicResponse) {
    setSelected(q);
    setFormError("");
    fetchDetails(q.id);
  }

  function closePanel() {
    setSelected(null);
    setDetails(null);
    setFormError("");
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteQuery(selected.id);
      await fetchQueries();
      setConfirmOpen(false);
      closePanel();
    } catch (e: any) {
      setDeleteError(e.message ?? "Delete failed.");
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  // ── Sidebar content ──────────────────────────────────────────────────────
  function renderSidebarContent() {
    if (!selected) return null;

    return (
      <div>
        {formError && <CAlert variant="error" message={formError} className="mb-4" />}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
          >
            {getQueryInitials(selected.name)}
          </div>
          <p className="text-base font-bold text-center" style={{ color: "var(--text-h)" }}>
            {selected.name}
          </p>
        </div>

        {detailsLoading ? (
          <div className="flex items-center justify-center py-8">
            <CSpinner size={24} />
          </div>
        ) : (
          <>
            <CDetailRow label="Description"    value={selected.description} />
            <CDetailRow label="Source"         value={selected.source} />
            <CDetailRow label="Model" value={selected.semantic_model.name} />
            <CDetailRow label="Package"        value={selected.semantic_model.package.name} />
            <CDetailRow label="Created"      value={formatDate(selected.created_at)} />
            <CDetailRow label="Last Updated" value={formatDate(selected.updated_at)} />
            <CDetailRow label="Created By"   value={selected.created_by} />
            <CDetailRow label="Updated By"   value={selected.updated_by} />
          </>
        )}
      </div>
    );
  }

  function renderSidebarFooter() {
    if (!selected) return null;
    return (
      <div className="flex flex-col gap-2">
        {deleteError && <CAlert variant="error" message={deleteError} />}
        <CButton variant="outline" fullWidth onClick={() => openQueryEditor(selected.id)}>
          <FaEdit size={14} /> Edit Query
        </CButton>
        <CButton
          variant="danger"
          fullWidth
          onClick={() => { setDeleteError(""); setConfirmOpen(true); }}
        >
          <FaTrash size={13} /> Delete Query
        </CButton>
      </div>
    );
  }

  const sidebarTitle = selected ? selected.name : "";

  const sidebarSubtitle = selected
    ? `${selected.semantic_model.package.name} · ${selected.source}`
    : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>Queries</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            Create and manage your data queries.
          </p>
        </div>
        <CButton variant="primary" onClick={() => window.open("/queries/new", "_blank", "noopener,noreferrer")}>
          <FaPlus size={12} /> New Query
        </CButton>
      </div>

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}

      {/* Metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CMetricCard label="Total"              value={total}        icon={<PiFileSqlFill size={18} />} />
        <CMetricCard label="Created This Month" value={thisMonth}    icon={<FaCalendarAlt size={16} />} trend="new this month" up={thisMonth > 0} />
        <CMetricCard label="Updated Today"      value={updatedToday} icon={<FaSyncAlt size={16} />}   trend={updatedToday > 0 ? "recently changed" : "no changes today"} up={updatedToday > 0} />
        <CMetricCard label="Models Used"        value={modelCount}   icon={<FaDatabase size={16} />} />
      </div>

      {/* Search */}
      <div className="mb-5 max-w-sm">
        <CTextInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, source, or model…"
          icon={<FaSearch size={13} />}
        />
      </div>

      {/* Query grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <CSpinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PiFileSqlFill size={36} style={{ color: "var(--border)" }} />
          <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
            {search ? "No queries match your search." : "No queries yet — create one above."}
          </p>
        </div>
      ) : (
        <div>
            <table className="w-full border-collapse text-xs">
                <thead>
                    {columns.map((column) => (
                        <th key={column} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-h)", borderBottom: "2px solid var(--border)", borderRight: "1px solid var(--border)" }}>
                            {column}
                        </th>
                    ))}
                </thead>
                <tbody>
                    {filtered.map((q, index) => (
                        <tr
                            key={q.id}
                            className={`transition-colors group cursor-pointer`}
                            style={{ background: index % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)" }}
                            onClick={() => openView(q)}
                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--accent-muted)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = index % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)"; }}
                        >
                            <td>{index + 1}</td>
                            <td className="px-3 py-2 font-semibold" style={{ color: "var(--text-h)" }}>
                              {q.name}
                            </td>
                            <td>{q.semantic_model.package.name}</td>
                            <td>{q.semantic_model.name}</td>
                            <td>
                              <span className="font-mono text-xs" style={{ color: "var(--accent-dim)" }}>
                                {q.source}
                              </span>
                            </td>
                            <td>
                              <span className="whitespace-nowrap">{formatDate(q.created_at)}</span>
                            </td>
                            <td>{q.created_by}</td>
                            {/* Actions column */}
                        </tr>
                    ))}
               
                </tbody>
            </table>
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
        title="Delete Query"
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
