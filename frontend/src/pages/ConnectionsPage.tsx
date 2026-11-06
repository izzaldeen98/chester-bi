import { useEffect, useState } from "react";
import { FaSearch, FaEdit, FaTrash, FaPlus, FaVial } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import CSelect from "../components/CSelect";
import CHCard, { CARD_COLS } from "../components/CHCard";
import { BoardFill, BoardHead, EmptyBoard, PageHead, Panel } from "../components/Board";
import CDialog from "../components/CDialog";
import CConfirmDialog from "../components/CConfirmDialog";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CDetailRow from "../components/CDetailRow";
import {
  getConnectionTypes,
  getConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  type ConnectionPublicResponse,
  type ConnectionDetailedResponse,
  type ConnectionType,
  type ConnectionField,
} from "../lib/Api";

type SidebarMode = "view" | "edit" | "create";

/* ── Credential fields ────────────────────────────────────────────────────
   Which fields a database needs is the backend adapter's business, not this
   page's: it serves them from /connections/types and they are rendered here
   generically. Adding a dialect used to mean another branch in this file and
   another set of useState hooks; now it means nothing at all. */
type FormValues = Record<string, string | boolean>;

function defaultsFor(spec: ConnectionType | undefined): FormValues {
  const values: FormValues = {};
  for (const f of spec?.fields ?? []) {
    values[f.name] = f.kind === "boolean" ? Boolean(f.default) : f.default == null ? "" : String(f.default);
  }
  return values;
}

/* Blank optional fields are dropped rather than sent as "", which the
   backend would store and later hand to a driver. */
function attributesFrom(spec: ConnectionType | undefined, values: FormValues) {
  const attrs: Record<string, string | number | boolean> = {};
  for (const f of spec?.fields ?? []) {
    const raw = values[f.name];
    if (f.kind === "boolean") { if (raw) attrs[f.name] = true; continue; }
    const text = String(raw ?? "").trim();
    if (!text) continue;
    attrs[f.name] = f.kind === "number" ? Number(text) : text;
  }
  return attrs;
}

function ConnectionFields({
  spec, values, onChange, secretsBlank = false,
}: {
  spec: ConnectionType | undefined;
  values: FormValues;
  onChange: (name: string, value: string | boolean) => void;
  secretsBlank?: boolean;
}) {
  if (!spec) return null;
  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--r-sm)] p-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
        {spec.label} connection
      </p>
      {secretsBlank && (
        <p className="text-xs" style={{ color: "var(--text-2)" }}>
          Secrets are never sent back to the browser — retype one only to change it.
        </p>
      )}
      {spec.fields.map((f: ConnectionField) => (
        <FieldControl key={f.name} field={f} value={values[f.name]} onChange={onChange} />
      ))}
    </div>
  );
}

function FieldControl({
  field, value, onChange,
}: {
  field: ConnectionField;
  value: string | boolean | undefined;
  onChange: (name: string, value: string | boolean) => void;
}) {
  const help = field.help ? (
    <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>{field.help}</p>
  ) : null;

  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text)" }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.name, e.target.checked)}
          style={{ accentColor: "var(--accent)", width: 14, height: 14 }}
        />
        {field.label}
        {help}
      </label>
    );
  }

  if (field.kind === "textarea") {
    return (
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--text)" }}>
          {field.label}
          {field.required && <span style={{ color: "var(--text-3)" }}> *</span>}
        </span>
        <textarea
          rows={5}
          value={String(value ?? "")}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          spellCheck={false}
          className="mono w-full rounded-[var(--r-sm)] px-2.5 py-2 text-[12px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            color: "var(--text)",
            resize: "vertical",
          }}
        />
        {help}
      </label>
    );
  }

  return (
    <div>
      <CTextInput
        label={field.label}
        type={field.kind === "number" ? "number" : field.kind === "password" ? "password" : "text"}
        value={String(value ?? "")}
        onChange={(v) => onChange(field.name, v)}
        placeholder={field.placeholder}
        required={field.required}
        icon={field.kind === "password" ? <RiLockPasswordFill size={15} /> : undefined}
        autoComplete={field.kind === "password" ? "new-password" : undefined}
      />
      {help}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

  // The supported dialects and their fields, as the backend declares them.
  const [types, setTypes] = useState<ConnectionType[]>([]);

  // Name/description are common to every dialect; the credentials are not,
  // so they live in one map keyed by the adapter's own field names.
  const [fName,        setFName]        = useState("");
  const [fDescription, setFDescription] = useState("");
  const [cName,        setCName]        = useState("");
  const [cType,        setCType]        = useState("");
  const [cDescription, setCDescription] = useState("");
  const [form,         setForm]         = useState<FormValues>({});

  const activeType = mode === "create" ? cType : selected?.type ?? "";
  const spec = types.find((t) => t.type === activeType);

  function setField(name: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Test connection
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Delete confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchConnections();
    // A dialect the backend cannot serve is one the user must not be offered.
    getConnectionTypes().then(setTypes).catch((e) =>
      setPageError(e.message ?? "Failed to load connection types."));
  }, []);

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
    // Secrets are not in the detail response and must not be, so they start
    // blank and are only sent when retyped.
    const current = types.find((t) => t.type === c.type);
    setForm({ ...defaultsFor(current), ...(d?.attributes ?? {}) } as FormValues);
    setFormError(""); setMode("edit");
  }

  function openCreate() {
    setSelected(null);
    setCName(""); setCType(""); setCDescription("");
    setForm({});
    setFormError(""); setMode("create");
  }

  function chooseType(next: string) {
    setCType(next);
    setForm(defaultsFor(types.find((t) => t.type === next)));
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
      const attrs = attributesFrom(spec, form);

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
    if (!cType) { setFormError("Pick a database type."); return; }
    setSaving(true); setFormError("");
    try {
      await createConnection({
        name: cName, type: cType,
        description: cDescription || undefined,
        connection_attributes: attributesFrom(spec, form),
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
            <CSelect
              label="Type"
              value={cType}
              onChange={chooseType}
              options={types.map((t) => ({ label: t.label, value: t.type }))}
              placeholder="Select type…"
              required
            />
            <CTextInput label="Description" value={cDescription} onChange={setCDescription} placeholder="Optional" />
          </div>

          <ConnectionFields spec={spec} values={form} onChange={setField} />
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

          <ConnectionFields spec={spec} values={form} onChange={setField} secretsBlank />
        </div>
      );
    }

    // view
    return (
      <div>
        <CDetailRow label="Status" value={selected.is_active ? "Active" : "Inactive"} />

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
            {(spec?.fields ?? [])
              .filter((f) => !f.secret && detail.attributes?.[f.name] !== undefined)
              .map((f) => (
                <CDetailRow key={f.name} label={f.label} value={String(detail.attributes[f.name])} />
              ))}
          </>
        ) : null}

        <CDetailRow label="Created"      value={formatDate(selected.created_at)} />
        <CDetailRow label="Last updated" value={formatDate(selected.updated_at)} />
        <CDetailRow label="Created by"   value={selected.created_by} />
        <CDetailRow label="Updated by"   value={selected.updated_by} />
      </div>
    );
  }

  function renderSidebarFooter() {
    if (mode === "create") {
      return (
        <div className="flex gap-2">
          <CButton variant="primary" fullWidth loading={saving} onClick={saveCreate}
            >
            Create connection
          </CButton>
          <CButton variant="ghost" onClick={closePanel} disabled={saving}>Cancel</CButton>
        </div>
      );
    }
    if (mode === "edit") {
      return (
        <div className="flex gap-2">
          <CButton variant="primary" fullWidth loading={saving} onClick={saveEdit}>Save changes</CButton>
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
          <FaEdit size={14} /> Edit connection
        </CButton>
        <CButton variant="danger" fullWidth onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>
          <FaTrash size={13} /> Delete connection
        </CButton>
      </div>
    );
  }

  // ── Sidebar meta ─────────────────────────────────────────────────────────
  const sidebarTitle =
    mode === "create" ? "New connection" :
    mode === "edit"   ? "Edit connection" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "" :
    mode === "edit"   ? "Update connection details" :
    selected ? selected.type : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHead title="Connections" context="Databases Chester queries live. Credentials are encrypted at rest.">
        <div className="w-full sm:w-64">
          <CTextInput value={search} onChange={setSearch} placeholder="Search connections…" icon={<FaSearch size={12} />} />
        </div>
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> New connection
        </CButton>
      </PageHead>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}



      {/* Connection grid */}
      <Panel flush bodyClassName="flex flex-col">
        {loading ? (
        <div className="flex items-center justify-center gap-3 py-20" style={{ color: "var(--text-3)" }}><CSpinner size={18} /><span className=" text-[12px]">Loading…</span></div>
        ) : filtered.length === 0 ? (
        <EmptyBoard line={search ? `No connections match “${search}”` : "No connections yet"} hint={search ? "Check the spelling or clear the search." : "Connect a database to model it. Uploaded files work without one."}
              action={search ? undefined : <CButton variant="primary" onClick={openCreate}><FaPlus size={10} /> Add connection</CButton>} />
        ) : (
          <>
          <BoardHead cols={CARD_COLS} colsNarrow="minmax(0,1fr) 100px">
            <span className="label">Connection</span>
            <span className="label col-secondary">Type</span>
            <span className="label text-right">State</span>
          </BoardHead>
          {filtered.map((c) => (
            <CHCard
              key={c.id}
              title={c.name}
              subtitle={c.description ?? undefined}
              meta={c.type}
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
      <CDialog isOpen={isSidebarOpen} onClose={closePanel} title={sidebarTitle} subtitle={sidebarSubtitle} footer={renderSidebarFooter()}>
        {renderSidebarContent()}
      </CDialog>

      {/* Delete confirmation */}
      <CConfirmDialog
        isOpen={confirmOpen}
        title="Delete connection"
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
