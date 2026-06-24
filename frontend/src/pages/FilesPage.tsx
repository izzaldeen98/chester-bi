import { useEffect, useRef, useState } from "react";
import { FaFileAlt, FaSearch, FaTrash, FaPlus, FaCalendarAlt, FaSyncAlt, FaFileCode } from "react-icons/fa";
import CMetricCard from "../components/CMetricCard";
import CInfoSideBar from "../components/CInfoSideBar";
import CConfirmDialog from "../components/CConfirmDialog";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import CDetailRow from "../components/CDetailRow";
import {
  getFiles,
  createFile,
  deleteFile,
  type FilePublicResponse,
} from "../lib/Api";

type SidebarMode = "view" | "create";

const columns = ["#", "Name", "File Name", "Extension", "Size", "Created At", "Created By"];

// ── Helpers ────────────────────────────────────────────────────────────────
function getFileInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
export default function FilesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data
  const [files, setFiles]         = useState<FilePublicResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch]       = useState("");

  // Sidebar
  const [mode, setMode]           = useState<SidebarMode>("view");
  const [selected, setSelected]   = useState<FilePublicResponse | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  // Create fields
  const [cName, setCName]               = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cFile, setCFile]               = useState<globalThis.File | null>(null);

  // Delete confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => { fetchFiles(); }, []);

  async function fetchFiles() {
    setLoading(true);
    setPageError("");
    try {
      setFiles(await getFiles());
    } catch (e: any) {
      const msg = e.message ?? "Failed to load files.";
      if (msg.toLowerCase().includes("no files found")) {
        setFiles([]);
      } else {
        setPageError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const total        = files.length;
  const thisMonth    = files.filter((f) => isThisMonth(f.created_at)).length;
  const updatedToday = files.filter((f) => isToday(f.updated_at)).length;
  const extensionCount = new Set(files.map((f) => f.extension).filter(Boolean)).size;

  const filtered = files.filter((f) => {
    const term = search.toLowerCase();
    return (
      f.name.toLowerCase().includes(term) ||
      (f.description ?? "").toLowerCase().includes(term) ||
      f.file_name.toLowerCase().includes(term) ||
      f.extension.toLowerCase().includes(term)
    );
  });

  const isSidebarOpen = mode === "create" || !!selected;

  function openView(file: FilePublicResponse) {
    setSelected(file);
    setMode("view");
    setFormError("");
  }

  function openCreate() {
    setSelected(null);
    setCName("");
    setCDescription("");
    setCFile(null);
    setFormError("");
    setMode("create");
  }

  function closePanel() {
    setSelected(null);
    setMode("view");
    setFormError("");
    setCFile(null);
  }

  async function saveCreate() {
    if (!cName.trim()) { setFormError("Name is required."); return; }
    if (!cFile) { setFormError("Please select a file to upload."); return; }

    setSaving(true);
    setFormError("");
    try {
      await createFile(cName.trim(), cFile, cDescription.trim() || undefined);
      await fetchFiles();
      closePanel();
    } catch (e: any) {
      setFormError(e.message ?? "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteFile(selected.id);
      await fetchFiles();
      setConfirmOpen(false);
      closePanel();
    } catch (e: any) {
      setDeleteError(e.message ?? "Delete failed.");
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  function renderSidebarContent() {
    if (mode === "create") {
      return (
        <div className="flex flex-col gap-4">
          {formError && <CAlert variant="error" message={formError} />}
          <CTextInput
            label="Name"
            value={cName}
            onChange={setCName}
            placeholder="e.g. Q2 Sales Report"
            required
          />
          <CTextArea
            label="Description"
            value={cDescription}
            onChange={setCDescription}
            placeholder="Optional description…"
            rows={3}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
              File <span className="text-[var(--accent)]">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setCFile(e.target.files?.[0] ?? null)}
            />
            <CButton
              variant="outline"
              fullWidth
              onClick={() => fileInputRef.current?.click()}
            >
              {cFile ? cFile.name : "Choose file…"}
            </CButton>
            {cFile && (
              <p className="text-xs" style={{ color: "var(--text)" }}>
                {formatFileSize(cFile.size)}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (!selected) return null;

    return (
      <div>
        <div className="mb-6 flex flex-col items-center gap-2">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
          >
            {getFileInitials(selected.name)}
          </div>
          <p className="text-base font-bold text-center" style={{ color: "var(--text-h)" }}>
            {selected.name}
          </p>
          {selected.extension && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium uppercase"
              style={{ background: "var(--bg-subtle)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              {selected.extension}
            </span>
          )}
        </div>
        <CDetailRow label="Description" value={selected.description} />
        <CDetailRow label="File Name"   value={selected.file_name} />
        <CDetailRow label="Size"        value={formatFileSize(selected.file_size)} />
        <CDetailRow label="Path"        value={selected.path} />
        <CDetailRow label="Created"     value={formatDate(selected.created_at)} />
        <CDetailRow label="Last Updated" value={formatDate(selected.updated_at)} />
        <CDetailRow label="Created By"  value={selected.created_by} />
        <CDetailRow label="Updated By"  value={selected.updated_by} />
      </div>
    );
  }

  function renderSidebarFooter() {
    if (mode === "create") {
      return (
        <div className="flex gap-2">
          <CButton
            variant="primary"
            fullWidth
            loading={saving}
            onClick={saveCreate}
            disabled={!cName.trim() || !cFile}
          >
            Upload File
          </CButton>
          <CButton variant="ghost" onClick={closePanel} disabled={saving}>Cancel</CButton>
        </div>
      );
    }
    if (!selected) return null;
    return (
      <div className="flex flex-col gap-2">
        {deleteError && <CAlert variant="error" message={deleteError} />}
        <CButton
          variant="danger"
          fullWidth
          onClick={() => { setDeleteError(""); setConfirmOpen(true); }}
        >
          <FaTrash size={13} /> Delete File
        </CButton>
      </div>
    );
  }

  const sidebarTitle =
    mode === "create" ? "Upload File" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "Choose a file and give it a name" :
    selected ? `${selected.file_name} · ${formatFileSize(selected.file_size)}` : "";

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>Files</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            Upload and manage your workspace files.
          </p>
        </div>
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> Upload File
        </CButton>
      </div>

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CMetricCard label="Total"              value={total}            icon={<FaFileAlt size={18} />} />
        <CMetricCard label="Created This Month" value={thisMonth}        icon={<FaCalendarAlt size={16} />} trend="new this month" up={thisMonth > 0} />
        <CMetricCard label="Updated Today"      value={updatedToday}     icon={<FaSyncAlt size={16} />} trend={updatedToday > 0 ? "recently changed" : "no changes today"} up={updatedToday > 0} />
        <CMetricCard label="File Types"         value={extensionCount}   icon={<FaFileCode size={16} />} />
      </div>

      <div className="mb-5 max-w-sm">
        <CTextInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, file name, or extension…"
          icon={<FaSearch size={13} />}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <CSpinner size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FaFileAlt size={36} style={{ color: "var(--border)" }} />
          <p className="mt-3 text-sm" style={{ color: "var(--text)" }}>
            {search ? "No files match your search." : "No files yet — upload one above."}
          </p>
        </div>
      ) : (
        <div>
          <table className="w-full border-collapse text-xs">
            <thead>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                  style={{ color: "var(--text-h)", borderBottom: "2px solid var(--border)", borderRight: "1px solid var(--border)" }}
                >
                  {column}
                </th>
              ))}
            </thead>
            <tbody>
              {filtered.map((file, index) => (
                <tr
                  key={file.id}
                  className="transition-colors group cursor-pointer"
                  style={{ background: index % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)" }}
                  onClick={() => openView(file)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--accent-muted)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = index % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)"; }}
                >
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: "var(--text-h)" }}>
                    {file.name}
                  </td>
                  <td className="px-3 py-2">{file.file_name}</td>
                  <td className="px-3 py-2 uppercase">{file.extension || "—"}</td>
                  <td className="px-3 py-2">{formatFileSize(file.file_size)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(file.created_at)}</td>
                  <td className="px-3 py-2">{file.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CInfoSideBar
        isOpen={isSidebarOpen}
        onClose={closePanel}
        title={sidebarTitle}
        subtitle={sidebarSubtitle}
        footer={renderSidebarFooter()}
      >
        {renderSidebarContent()}
      </CInfoSideBar>

      <CConfirmDialog
        isOpen={confirmOpen}
        title="Delete File"
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
