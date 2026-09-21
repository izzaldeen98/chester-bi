import { useEffect, useState } from "react";
import { FaSearch, FaEdit, FaTrash, FaPlus, FaVial } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import CSelect from "../components/CSelect";
import CHCard from "../components/CHCard";
import { BoardFill, BoardHead, EmptyBoard, Panel } from "../components/Board";
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
  { label: "MySQL", value: "mysql" },
  { label: "Snowflake", value: "snowflake" },
  { label: "BigQuery", value: "bigquery" },
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
  const [cAccount,     setCAccount]     = useState("");
  const [cProjectId,   setCProjectId]   = useState("");
  const [cCredentials, setCCredentials] = useState("");
  const [cPrivateKey,  setCPrivateKey]  = useState("");
  const [cPrivateKeyPassphrase, setCPrivateKeyPassphrase] = useState("");
  const [cSchema,      setCSchema]      = useState("");
  const [cWarehouse,   setCWarehouse]   = useState("");

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
    setSaving(true); setFormError("");
    let connection_attributes: Record<string, string | number> = {};
    try {
      if (cType === "postgres" || cType === "mysql") {
        connection_attributes = {
          host: cHost, port: Number(cPort) || 5432,
          database: cDatabase, username: cUsername, password: cPassword,
        };
      }
      if (cType === "snowflake") {
        connection_attributes = {
          account: cAccount, username: cUsername, password: cPassword, schema: cSchema, warehouse: cWarehouse, private_key: cPrivateKey, private_key_passphrase: cPrivateKeyPassphrase,
        }
      }
      if (cType === "bigquery") {
        connection_attributes = {
          project_id: cProjectId, credentials: cCredentials,
        };
      }
      await createConnection({
        name: cName, type: cType,
        description: cDescription || undefined,
        connection_attributes: connection_attributes,
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

          <div className="rounded-[var(--r-sm)] p-4 flex flex-col gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>General</p>
            <CTextInput label="Name" value={cName} onChange={setCName} placeholder="e.g. Production DB" required />
            <CSelect label="Type" value={cType} onChange={setCType} options={CONNECTION_TYPES} placeholder="Select type…" required />
            <CTextInput label="Description" value={cDescription} onChange={setCDescription} placeholder="Optional" />
          </div>
          {(cType === "postgres" || cType === "mysql") && (
            <div className="rounded-[var(--r-sm)] p-4 flex flex-col gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>Connection Attributes</p>
              <CTextInput label="Host"     value={cHost}     onChange={setCHost}     placeholder="e.g. localhost" required />
              <CTextInput label="Port"     value={cPort}     onChange={setCPort}     placeholder="e.g. 5432" type="number" />
              <CTextInput label="Database" value={cDatabase} onChange={setCDatabase} placeholder="e.g. my_db" required />
              <CTextInput label="Username" value={cUsername} onChange={setCUsername} placeholder="e.g. admin" required />
              <CTextInput label="Password" value={cPassword} onChange={setCPassword} type="password" icon={<RiLockPasswordFill size={15} />} autoComplete="new-password" />
            </div>
          )}
          {cType === "snowflake" && (
            <div className="rounded-[var(--r-sm)] p-4 flex flex-col gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>Connection Attributes</p>
              <CTextInput label="Account" value={cAccount} onChange={setCAccount} placeholder="e.g. my_account"  />
              <CTextInput label="Username" value={cUsername} onChange={setCUsername} placeholder="e.g. admin"  />
              <CTextInput label="Password" value={cPassword} onChange={setCPassword} type="password" icon={<RiLockPasswordFill size={15} />} autoComplete="new-password" />
              <CTextInput label="Schema" value={cSchema} onChange={setCSchema} placeholder="e.g. my_schema"  />
              <CTextInput label="Warehouse" value={cWarehouse} onChange={setCWarehouse} placeholder="e.g. my_warehouse" required />
              <CTextInput label="Private Key" value={cPrivateKey} onChange={setCPrivateKey} type="text" placeholder="e.g. -----BEGIN PRIVATE KEY-----\nMIIEogIBAAKCAQEAwgwgwgSCAgEAAoIBAQCB0LDQu9C40L3QviAgMAwGCCqGSIb3DQEJ...
              \n-----END PRIVATE KEY-----
              " />
              <CTextInput label="Private Key Passphrase" value={cPrivateKeyPassphrase} onChange={setCPrivateKeyPassphrase} type="text" placeholder="e.g. my_passphrase" />
            </div>
          )}
          {cType === "bigquery" && (
            <div className="rounded-[var(--r-sm)] p-4 flex flex-col gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>Connection Attributes</p>
              <CTextInput label="Project ID" value={cProjectId} onChange={setCProjectId} placeholder="e.g. my_project" required />
              <CTextInput label="Credentials" value={cCredentials} onChange={setCCredentials} type="text" placeholder='{"type": "service_account", "project_id": "my_project"}' />
            </div>
          )}
        </div>
      );
    }

    if (!selected) return null;

    if (mode === "edit") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}

          <div className="rounded-[var(--r-sm)] p-4 flex flex-col gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>General</p>
            <CTextInput label="Name"        value={fName}        onChange={setFName}        required />
            <CTextInput label="Description" value={fDescription} onChange={setFDescription} />
          </div>

          <div className="rounded-[var(--r-sm)] p-4 flex flex-col gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>Connection Attributes</p>
            <p className="text-xs" style={{ color: "var(--text-2)" }}>Leave a field blank to keep the existing value.</p>
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
            className="flex h-16 w-16 items-center justify-center rounded-[var(--r-sm)] text-xl font-bold"
            style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-line)" }}
          >
            {getInitials(selected.name)}
          </div>
          <p className="text-base font-bold text-center" style={{ color: "var(--text)" }}>{selected.name}</p>
          <div className="flex items-center gap-2">
            <span className="rounded-[var(--r-sm)] px-3 py-0.5 text-xs font-medium"
              style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-line)" }}>
              {selected.type}
            </span>
            <span className={`rounded-[var(--r-sm)] px-3 py-0.5 text-xs font-medium ${
              selected.is_active
                ? "text-[var(--ok)] bg-[var(--ok-soft)]"
                : "text-[var(--danger)] bg-[var(--danger-soft)]"
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
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-2)" }}>
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
            >
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
    mode === "create" ? "New connection" :
    mode === "edit"   ? "Edit Connection" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "Fill in the details below" :
    mode === "edit"   ? "Update connection details" :
    selected ? selected.type : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header
        className="flex shrink-0 flex-wrap items-center gap-4 px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-none tracking-[-0.02em]">Connections</h1>
          <p className="mt-1.5 text-[13px] leading-none" style={{ color: "var(--text-3)" }}>Manage data source connections.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> New connection
        </CButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}


      {/* Search */}
      <div className="mb-5 max-w-sm">
        <CTextInput value={search} onChange={setSearch} placeholder="Search by name, type or description…" icon={<FaSearch size={13} />} />
      </div>

      {/* Connection grid */}
      <Panel label="Connections" flush bodyClassName="flex flex-col">
        {loading ? (
        <div className="flex items-center justify-center gap-3 py-20" style={{ color: "var(--text-3)" }}><CSpinner size={18} /><span className=" text-[12px]">Loading…</span></div>
        ) : filtered.length === 0 ? (
        <EmptyBoard line={search ? "No match on this board" : "No sources connected"} hint={search ? "Try a different search." : "Connect a database or upload a file — everything downstream is modelled from it."}
              action={search ? undefined : <CButton variant="primary" onClick={openCreate}><FaPlus size={10} /> Add connection</CButton>} />
        ) : (
          <>
          <BoardHead cols="42px minmax(0,1fr) 140px 108px">
            <span className="label"></span>
            <span className="label">Connection</span>
            <span className="label">Type</span>
            <span className="label text-right">State</span>
          </BoardHead>
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
          <BoardFill />
          </>
        )}
      </Panel>

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
    </div>  );
}
