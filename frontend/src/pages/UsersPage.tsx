import { useEffect, useState } from "react";
import { FaUser, FaSearch, FaEdit, FaTrash } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import { IoMdMail } from "react-icons/io";
import CHCard, { CARD_COLS_AVATAR } from "../components/CHCard";
import { BoardFill, BoardHead, EmptyBoard, PageHead, Panel } from "../components/Board";
import CDialog from "../components/CDialog";
import CConfirmDialog from "../components/CConfirmDialog";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CDetailRow from "../components/CDetailRow";
import {
  getUsers,
  createUser,
  updateUser,
  type UserPublicResponse,
} from "../lib/Api";

type SidebarMode = "view" | "edit" | "create";

// ── Permission definitions ─────────────────────────────────────────────────
const PERMISSION_GROUPS: Record<string, string[]> = {
  dashboards:  ["list", "view", "edit", "delete", "create", "*"],
  users:       ["list", "edit", "create", "*"],
  connections: ["create", "edit", "delete", "list", "*"],
  models:      ["view", "edit", "delete", "create", "list", "*"],
  definitions: ["edit", "delete", "create", "list", "*"],
};

// ── Permission helpers ─────────────────────────────────────────────────────
function parsePermissions(str: string): string[] | undefined {
  const trimmed = str.trim();
  if (!trimmed) return undefined;
  const items = trimmed.split(";").map((p) => p.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function formatPermissions(perms: any): string {
  if (!perms) return "";
  if (Array.isArray(perms)) return perms.join(";");
  if (typeof perms === "object") {
    return Object.entries(perms).map(([k, v]) => `${k}:${v}`).join(";");
  }
  return String(perms);
}

// ── PermissionPicker ───────────────────────────────────────────────────────
interface PermissionPickerProps {
  value: string;
  onChange: (val: string) => void;
}

function PermissionPicker({ value, onChange }: PermissionPickerProps) {
  const selected = new Set(value ? value.split(";").map((p) => p.trim()).filter(Boolean) : []);

  function toggle(perm: string) {
    const next = new Set(selected);
    if (next.has(perm)) {
      next.delete(perm);
    } else {
      next.add(perm);
    }
    onChange(Array.from(next).join(";"));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium" style={{ color: "var(--text)" }}>Permissions</p>
      <div className="rounded-[var(--r-sm)] p-3 flex flex-col gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {Object.entries(PERMISSION_GROUPS).map(([resource, actions]) => (
          <div key={resource}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
              {resource}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {actions.map((action) => {
                const perm = `${resource}:${action}`;
                const active = selected.has(perm);
              return (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => toggle(perm)}
                    className="rounded-[var(--r-sm)] px-2 py-0.5 text-xs font-medium transition-colors"
                    style={
                      active
                        ? { background: "var(--accent)", color: "var(--solid-ink)", border: "1px solid var(--accent)" }
                        : { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }
                    }
                  >
                    {action === "*" ? "all *" : action}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selected.size > 0 && (
        <p className="text-xs" style={{ color: "var(--text-2)" }}>
          {selected.size} permission{selected.size !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getInitials(u: UserPublicResponse) {
  return `${u.first_name[0] ?? ""}${u.last_name[0] ?? ""}`.toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}


function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 rounded-[var(--r-sm)] transition-colors duration-200"
        style={{ background: checked ? "var(--accent)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-[var(--r-sm)] bg-white shadow transition-transform duration-200"
          style={{ left: checked ? "calc(100% - 1.375rem)" : "0.125rem" }}
        />
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function UsersPage() {
  // Data
  const [users, setUsers]         = useState<UserPublicResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch]       = useState("");

  // Sidebar
  const [mode, setMode]           = useState<SidebarMode>("view");
  const [selected, setSelected]   = useState<UserPublicResponse | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  // Edit fields
  const [fFirst,       setFFirst]       = useState("");
  const [fLast,        setFLast]        = useState("");
  const [fUsername,    setFUsername]    = useState("");
  const [fEmail,       setFEmail]       = useState("");
  const [fRole,        setFRole]        = useState("");
  const [fActive,      setFActive]      = useState(true);
  const [fPermissions, setFPermissions] = useState("");

  // Create fields
  const [cFirst,    setCFirst]    = useState("");
  const [cLast,     setCLast]     = useState("");
  const [cUsername, setCUsername] = useState("");
  const [cPassword, setCPassword] = useState("");

  // Delete confirm dialog
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [deleteError,    setDeleteError]    = useState("");

  // ── Fetch on mount ─────────────────────────────────────────────────────
  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    setPageError("");
    try {
      setUsers(await getUsers());
    } catch (e: any) {
      setPageError(e.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  // ── Derived metrics ────────────────────────────────────────────────────

  // ── Search ─────────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  // ── Open modes ─────────────────────────────────────────────────────────
  const isSidebarOpen = mode === "create" || !!selected;

  function openView(u: UserPublicResponse) {
    setSelected(u); setMode("view"); setFormError("");
  }

  function openEdit(u: UserPublicResponse) {
    setSelected(u);
    setFFirst(u.first_name); setFLast(u.last_name);
    setFUsername(u.username); setFEmail(u.email ?? "");
    setFRole(u.role ?? ""); setFActive(u.is_active);
    setFPermissions(formatPermissions(u.permissions));
    setFormError(""); setMode("edit");
  }

  function openCreate() {
    setSelected(null);
    setCFirst(""); setCLast(""); setCUsername(""); setCPassword("");
    setFormError(""); setMode("create");
  }

  function closePanel() {
    setSelected(null); setMode("view"); setFormError("");
  }

  // ── Save edit ──────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!selected) return;
    if (!fFirst.trim() || !fLast.trim() || !fUsername.trim()) {
      setFormError("First name, last name and username are required."); return;
    }
    setSaving(true); setFormError("");
    try {
      await updateUser(selected.id, {
        first_name: fFirst, last_name: fLast, username: fUsername,
        email: fEmail || undefined, role: fRole || undefined, is_active: fActive,
        permissions: parsePermissions(fPermissions),
      });
      await fetchUsers();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Update failed.");
    } finally { setSaving(false); }
  }

  // ── Save create ────────────────────────────────────────────────────────
  async function saveCreate() {
    if (!cUsername.trim() || !cFirst.trim() || !cLast.trim()) {
      setFormError("Username, first name and last name are required."); return;
    }
    setSaving(true); setFormError("");
    try {
      await createUser({
        username: cUsername, first_name: cFirst,
        last_name: cLast, password: cPassword || undefined,
      });
      await fetchUsers();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Create failed.");
    } finally { setSaving(false); }
  }

  // ── Delete user ──────────────────────────────────────────────────────────
  async function deleteUser(userId: string) {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(userId);
      await fetchUsers();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Delete failed.");
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteUser(selected.id);
      await fetchUsers();
      setConfirmOpen(false);
      closePanel();
    } catch (e: any) {
      setDeleteError(e.message ?? "Delete failed.");
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  // ── Sidebar content — called as function NOT as <Component />, ─────────
  // so React never re-mounts the inputs on re-render (fixes focus loss)
  function renderSidebarContent() {
    if (mode === "create") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}
          <CTextInput label="Username"   value={cUsername} onChange={setCUsername} placeholder="e.g. jsmith"    required autoComplete="off" />
          <CTextInput label="First Name" value={cFirst}    onChange={setCFirst}    placeholder="John"           required />
          <CTextInput label="Last Name"  value={cLast}     onChange={setCLast}     placeholder="Smith"          required />
          <CTextInput label="Password"   value={cPassword} onChange={setCPassword} type="password" placeholder="Leave blank to set later" icon={<RiLockPasswordFill size={15} />} autoComplete="new-password" />
        </div>
      );
    }

    if (!selected) return null;

    if (mode === "edit") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}
          <CTextInput label="First Name" value={fFirst}    onChange={setFFirst}    required />
          <CTextInput label="Last Name"  value={fLast}     onChange={setFLast}     required />
          <CTextInput label="Username"   value={fUsername} onChange={setFUsername} required autoComplete="off" />
          <CTextInput label="Email"      value={fEmail}    onChange={setFEmail}    type="email" icon={<IoMdMail size={15} />} />
          <CTextInput label="Role" value={fRole} onChange={setFRole} placeholder="e.g. admin, viewer" />
          <PermissionPicker value={fPermissions} onChange={setFPermissions} />
          <Toggle label="Active" checked={fActive} onChange={setFActive} />
        </div>
      );
    }

    // view
    return (
      <div>
        <CDetailRow label="Status" value={selected.is_active ? "Active" : "Inactive"} />
        <CDetailRow label="Username"    value={selected.username} />
        <CDetailRow label="Email"       value={selected.email} />
        <CDetailRow label="Role"        value={selected.role} />
        <CDetailRow label="Permissions" value={formatPermissions(selected.permissions) || "—"} />
        <CDetailRow label="Created"     value={formatDate(selected.created_at)} />
        <CDetailRow label="Last updated"  value={formatDate(selected.updated_at)} />
        {selected.created_by && <CDetailRow label="Created by" value={String(selected.created_by)} />}
        {selected.updated_by && <CDetailRow label="Updated by" value={String(selected.updated_by)} />}

      </div>
    );
  }

  function renderSidebarFooter() {
    if (mode === "create") {
      return (
        <div className="flex gap-2">
          <CButton variant="primary" fullWidth loading={saving} onClick={saveCreate} disabled={!cUsername.trim() || !cFirst.trim() || !cLast.trim()}>
            Create user
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
        <CButton variant="outline" fullWidth onClick={() => openEdit(selected)}>
          <FaEdit size={14} /> Edit User
        </CButton>
        <CButton
          variant="danger"
          fullWidth
          onClick={() => { setDeleteError(""); setConfirmOpen(true); }}
        >
          <FaTrash size={13} /> Delete user
        </CButton>
      </div>
    );
  }

  // ── Sidebar meta ───────────────────────────────────────────────────────
  const sidebarTitle =
    mode === "create" ? "Add New User" :
    mode === "edit"   ? "Edit User" :
    selected ? `${selected.first_name} ${selected.last_name}` : "";

  const sidebarSubtitle =
    mode === "create" ? "" :
    selected ? `@${selected.username}` : "";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHead title="Users" context="People in this workspace and what they are allowed to do.">
        <div className="w-full sm:w-64">
          <CTextInput
            value={search}
            onChange={setSearch}
            placeholder="Search users…"
            icon={<FaSearch size={12} />}
          />
        </div>
        <CButton variant="primary" onClick={openCreate}>
          <FaUser size={13} /> Add user
        </CButton>
      </PageHead>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}



      {/* User grid */}
      <Panel flush bodyClassName="flex flex-col">
        {loading ? (
        <div className="flex items-center justify-center py-20">
          <CSpinner size={28} />
        </div>
        ) : filtered.length === 0 ? (
        <EmptyBoard line={search ? `No users match “${search}”` : "No other members yet"} hint={search ? "Check the spelling or clear the search." : "Add people so they can open artifacts and build models."} />
        ) : (
          <>
          <BoardHead cols={CARD_COLS_AVATAR} colsNarrow="28px minmax(0,1fr) 100px">
            <span className="label"></span>
            <span className="label">Name</span>
            <span className="label col-secondary">Role</span>
            <span className="label text-right">State</span>
          </BoardHead>
          {filtered.map((u) => (
            <CHCard
              key={u.id}
              title={`${u.first_name} ${u.last_name}`}
              subtitle={`@${u.username}`}
              meta={u.role}
              initials={getInitials(u)}
              isSelected={selected?.id === u.id && mode !== "create"}
              badge={{ label: u.is_active ? "Active" : "Inactive", variant: u.is_active ? "green" : "red" }}
              onClick={() => openView(u)}
            />
          ))}
          <BoardFill />
          </>
        )}
      </Panel>

      {/* Sidebar */}
      <CDialog
        isOpen={isSidebarOpen}
        onClose={closePanel}
        title={sidebarTitle}
        subtitle={sidebarSubtitle}
        footer={renderSidebarFooter()}
      >
        {renderSidebarContent()}
      </CDialog>

      {/* Delete confirmation */}
      <CConfirmDialog
        isOpen={confirmOpen}
        title="Delete user"
        message={
          selected
            ? `Are you sure you want to delete ${selected.first_name} ${selected.last_name} (@${selected.username})? This action cannot be undone.`
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
    </div>  );
}
