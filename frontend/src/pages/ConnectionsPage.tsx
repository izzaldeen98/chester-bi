import { useEffect, useState } from "react";
import { MdOutlineCloud, MdBlock } from "react-icons/md";
import { FaSearch, FaEdit, FaTrash, FaPlus, FaCheckCircle, FaPlug, FaVial } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import CSelect from "../components/CSelect";
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
  getConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  type ConnectionPublicResponse,
  type ConnectionDetailedResponse,
} from "../lib/Api";

type SidebarMode = "view" | "edit" | "create";

// ── Connection type options ────────────────────────────────────────────────
const CONNECTION_TYPES = [
  { label: "PostgreSQL", value: "postgres" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ConnectionsPage() {
  // Data
  const [connections, setConnections] = useState<ConnectionPublicResponse[]>([]);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState("");
  const [search, setSearch]           = useState("");

  // Sidebar
  const [mode, setMode]                       = useState<SidebarMode>("view");
  const [selected, setSelected]               = useState<ConnectionPublicResponse | null>(null);
  const [detail, setDetail]                   = useState<ConnectionDetailedResponse | null>(null);
  const [detailLoading, setDetailLoading]     = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [formError, setFormError]             = useState("");

  // Edit fields (connection attributes)
  const [fName,        setFName]        = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fHost,        setFHost]        = useState("");
  const [fPort,        setFPort]        = useState("");
  const [fDatabase,    setFDatabase]    = useState("");
  const [fUsername,    setFUsername]    = useState("");
  const [fPassword,    setFPassword]    = useState("");

  // Create fields
  const [cName,        setCName]        = useState("");
  const [cType,        setCType]        = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cHost,        setCHost]        = useState("");
  const [cPort,        setCPort]        = useState("");
  const [cDatabase,    setCDatabase]    = useState("");
  const [cUsername,    setCUsername]    = useState("");
  const [cPassword,    setCPassword]    = useState("");

  // Test connection
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Delete confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => { fetchConnections(); }, []);

  async function fetchConnections() {
    setLoading(true); setPageError("");
    try {
      setConnections(await getConnections());
    } catch (e: any) {
      setPageError(e.message ?? "Failed to load connections.");
    } finally { setLoading(false); }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────
  const total    = connections.length;
  const active   = connections.filter((c) => c.is_active).length;
  const inactive = total - active;
  const types    = new Set(connections.map((c) => c.type)).size;

  // ── Search ───────────────────────────────────────────────────────────────
  const filtered = connections.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q)
    );
  });

  // ── Open modes ───────────────────────────────────────────────────────────
  const isSidebarOpen = mode === "create" || !!selected;

  async function openView(c: ConnectionPublicResponse) {
    setSelected(c); setMode("view"); setFormError(""); setTestResult(null);
    setDetail(null); setDetailLoading(true);
    try {
      setDetail(await getConnection(c.id));
    } catch {
      // detail stays null — view falls back to list fields
    } finally { setDetailLoading(false); }
  }

  function openEdit(c: ConnectionPublicResponse, d: ConnectionDetailedResponse | null) {
    setSelected(c);
    setFName(c.name);
    setFDescription(c.description ?? "");
    setFHost(d?.host ?? "");
    setFPort(d?.port !== undefined ? String(d.port) : "");
    setFDatabase(d?.database ?? "");
    setFUsername(d?.username ?? "");
    setFPassword("");
    setFormError(""); setMode("edit");
  }

  function openCreate() {
    setSelected(null);
    setCName(""); setCType(""); setCDescription("");
    setCHost(""); setCPort(""); setCDatabase(""); setCUsername(""); setCPassword("");
    setFormError(""); setMode("create");
  }

  function closePanel() {
    setSelected(null); setDetail(null); setMode("view"); setFormError(""); setTestResult(null);
  }

  // ── Save edit ────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!selected) return;
    if (!fName.trim()) { setFormError("Name is required."); return; }
    setSaving(true); setFormError("");
    try {
      const attrs: Record<string, string | number> = {};
      if (fHost.trim())     attrs.host     = fHost.trim();
      if (fPort.trim())     attrs.port     = Number(fPort);
      if (fDatabase.trim()) attrs.database = fDatabase.trim();
      if (fUsername.trim()) attrs.username = fUsername.trim();
      if (fPassword.trim()) attrs.password = fPassword.trim();

      await updateConnection(selected.id, {
        name: fName,
        description: fDescription || undefined,
        ...(Object.keys(attrs).length > 0 && { connection_attributes: attrs }),
      });
      await fetchConnections();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Update failed.");
    } finally { setSaving(false); }
  }

  // ── Save create ──────────────────────────────────────────────────────────
  async function saveCreate() {
    if (!cName.trim() || !cType.trim() || !cHost.trim() || !cDatabase.trim() || !cUsername.trim()) {
      setFormError("Name, type, host, database and username are required."); return;
    }
    setSaving(true); setFormError("");
    try {
      await createConnection({
        name: cName, type: cType,
        description: cDescription || undefined,
        connection_attributes: {
          host: cHost, port: Number(cPort) || 5432,
          database: cDatabase, username: cUsername, password: cPassword,
        },
      });
      await fetchConnections();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Create failed.");
    } finally { setSaving(false); }
  }

  // ── Test connection ──────────────────────────────────────────────────────
  async function handleTest() {
    if (!selected) return;
    setTesting(true); setTestResult(null);
    try {
      await testConnection(selected.id);
      setTestResult({ ok: true, msg: "Connection successful!" });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message ?? "Connection test failed." });
    } finally { setTesting(false); }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected) return;
    setDeleting(true); setDeleteError("");
    try {
      await deleteConnection(selected.id);
      await fetchConnections();
      setConfirmOpen(false); closePanel();
    } catch (e: any) {
      setDeleteError(e.message ?? "Delete failed."); setConfirmOpen(false);
    } finally { setDeleting(false); }
  }

  // ── Sidebar content ──────────────────────────────────────────────────────
  function renderSidebarContent() {
    if (mode === "create") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>General</p>
            <CTextInput label="Name" value={cName} onChange={setCName} placeholder="e.g. Production DB" required />
            <CSelect label="Type" value={cType} onChange={setCType} options={CONNECTION_TYPES} placeholder="Select type…" required />
            <CTextInput label="Description" value={cDescription} onChange={setCDescription} placeholder="Optional" />
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Connection Attributes</p>
            <CTextInput label="Host"     value={cHost}     onChange={setCHost}     placeholder="e.g. localhost" required />
            <CTextInput label="Port"     value={cPort}     onChange={setCPort}     placeholder="e.g. 5432" type="number" />
            <CTextInput label="Database" value={cDatabase} onChange={setCDatabase} placeholder="e.g. my_db" required />
            <CTextInput label="Username" value={cUsername} onChange={setCUsername} placeholder="e.g. admin" required />
            <CTextInput label="Password" value={cPassword} onChange={setCPassword} type="password" icon={<RiLockPasswordFill size={15} />} autoComplete="new-password" />
          </div>
        </div>
      );
    }

    if (!selected) return null;

    if (mode === "edit") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>General</p>
            <CTextInput label="Name"        value={fName}        onChange={setFName}        required />
            <CTextInput label="Description" value={fDescription} onChange={setFDescription} />
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>Connection Attributes</p>
            <p className="text-xs" style={{ color: "var(--text)" }}>Leave a field blank to keep the existing value.</p>
            <CTextInput label="Host"     value={fHost}     onChange={setFHost}     placeholder="unchanged" />
            <CTextInput label="Port"     value={fPort}     onChange={setFPort}     placeholder="unchanged" type="number" />
            <CTextInput label="Database" value={fDatabase} onChange={setFDatabase} placeholder="unchanged" />
            <CTextInput label="Username" value={fUsername} onChange={setFUsername} placeholder="unchanged" />
            <CTextInput label="Password" value={fPassword} onChange={setFPassword} type="password" placeholder="unchanged" icon={<RiLockPasswordFill size={15} />} autoComplete="new-password" />
          </div>
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
            {getInitials(selected.name)}
          </div>
          <p className="text-base font-bold text-center" style={{ color: "var(--text-h)" }}>{selected.name}</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-3 py-0.5 text-xs font-medium"
              style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}>
              {selected.type}
            </span>
            <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
              selected.is_active
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            }`}>
              {selected.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {testResult && (
          <div className="mb-4">
            <CAlert variant={testResult.ok ? "success" : "error"} message={testResult.msg} />
          </div>
        )}

        <CDetailRow label="Description"  value={selected.description} />

        {detailLoading ? (
          <div className="flex justify-center py-4"><CSpinner size={20} /></div>
        ) : detail ? (
          <>
            <div className="my-3">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text)" }}>
                Connection Attributes
              </p>
            </div>
            <CDetailRow label="Host"     value={detail.host} />
            <CDetailRow label="Port"     value={String(detail.port)} />
            <CDetailRow label="Database" value={detail.database} />
            <CDetailRow label="Username" value={detail.username} />
          </>
        ) : null}

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
          <CButton variant="primary" fullWidth loading={saving} onClick={saveCreate}
            disabled={!cName.trim() || !cType.trim() || !cHost.trim() || !cDatabase.trim() || !cUsername.trim()}>
            Create Connection
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
        <CButton variant="outline" fullWidth loading={testing} onClick={handleTest}>
          <FaVial size={13} /> Test Connection
        </CButton>
        <CButton variant="outline" fullWidth onClick={() => openEdit(selected, detail)}>
          <FaEdit size={14} /> Edit Connection
        </CButton>
        <CButton variant="danger" fullWidth onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>
          <FaTrash size={13} /> Delete Connection
        </CButton>
      </div>
    );
  }

  // ── Sidebar meta ─────────────────────────────────────────────────────────
  const sidebarTitle =
    mode === "create" ? "New Connection" :
    mode === "edit"   ? "Edit Connection" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "Fill in the details below" :
    mode === "edit"   ? "Update connection details" :
    selected ? selected.type : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>Connections</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>Manage data source connections.</p>
        </div>
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> New Connection
        </CButton>
      </div>

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}

      {/* Metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CMetricCard label="Total"    value={total}    icon={<MdOutlineCloud size={18} />} />
        <CMetricCard label="Active"   value={active}   icon={<FaCheckCircle size={16} />} trend="currently active" up={active > 0} />
        <CMetricCard label="Inactive" value={inactive} icon={<MdBlock size={18} />}        trend={inactive === 0 ? "all good" : "need attention"} up={inactive === 0} />
        <CMetricCard label="Types"    value={types}    icon={<FaPlug size={15} />}          trend="distinct types" />
      </div>

      {/* Search */}
      <div className="mb-5 max-w-sm">
        <CTextInput value={search} onChange={setSearch} placeholder="Search by name, type or description…" icon={<FaSearch size={13} />} />
      </div>

      {/* Connection grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><CSpinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MdOutlineCloud size={36} style={{ color: "var(--border)" }} />
          <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
            {search ? "No connections match your search." : "No connections yet — add one above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CHCard
              key={c.id}
              title={c.name}
              subtitle={c.description ?? c.type}
              meta={c.type}
              initials={getInitials(c.name)}
              isSelected={selected?.id === c.id && mode !== "create"}
              badge={{ label: c.is_active ? "Active" : "Inactive", variant: c.is_active ? "green" : "red" }}
              onClick={() => openView(c)}
            />
          ))}
        </div>
      )}

      {/* Sidebar */}
      <CInfoSideBar isOpen={isSidebarOpen} onClose={closePanel} title={sidebarTitle} subtitle={sidebarSubtitle} footer={renderSidebarFooter()}>
        {renderSidebarContent()}
      </CInfoSideBar>

      {/* Delete confirmation */}
      <CConfirmDialog
        isOpen={confirmOpen}
        title="Delete Connection"
        message={selected ? `Are you sure you want to delete "${selected.name}"? This action cannot be undone.` : ""}
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
