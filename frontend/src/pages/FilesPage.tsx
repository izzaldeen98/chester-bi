import { useEffect, useState } from "react";
import { FaSearch, FaTrash, FaPlus } from "react-icons/fa";
import CDialog from "../components/CDialog";
import CConfirmDialog from "../components/CConfirmDialog";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CAlert from "../components/CAlert";
import CSpinner from "../components/CSpinner";
import { BoardFill, EmptyBoard, PageHead, Panel } from "../components/Board";
import CDetailRow from "../components/CDetailRow";
import {
  getFiles,
  createFiles,
  baseFileName,
  deleteFile,
  type FilePublicResponse,
} from "../lib/Api";

type SidebarMode = "view" | "create";

const columns = ["#", "Name", "File Name", "Extension", "Size", "Created At", "Created by"];

// ── Helpers ────────────────────────────────────────────────────────────────

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
export default function FilesPage() {
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
  const [cDescription, setCDescription] = useState("");
  const [cFiles, setCFiles]             = useState<globalThis.File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

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
    setCDescription("");
    setCFiles([]);
    setFormError("");
    setMode("create");
  }

  function closePanel() {
    setSelected(null);
    setMode("view");
    setFormError("");
    setCFiles([]);
    setUploadProgress(null);
  }

  function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    // Snapshot to a real array HERE, eagerly. `picked` is the input's *live*
    // FileList, and the caller resets input.value right after this returns to
    // allow re-picking the same file — a lazy `Array.from(picked)` inside the
    // state updater would run after that reset and read an empty list.
    const added = Array.from(picked);
    setCFiles((prev) => [...prev, ...added]);
  }

  function removeFile(index: number) {
    setCFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveCreate() {
    if (cFiles.length === 0) { setFormError("Please select at least one file to upload."); return; }

    setSaving(true);
    setFormError("");
    setUploadProgress({ done: 0, total: cFiles.length });

    const outcomes = await createFiles(cFiles, cDescription.trim() || undefined, (done, total) =>
      setUploadProgress({ done, total }),
    );

    await fetchFiles();
    setSaving(false);
    setUploadProgress(null);

    const failed = outcomes.filter((o) => o.error);
    if (failed.length > 0) {
      setFormError(failed.map((o) => `${o.file.name}: ${o.error}`).join("; "));
      return;
    }
    closePanel();
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
          <CTextArea
            label="Description"
            value={cDescription}
            onChange={setCDescription}
            placeholder="Optional description, applied to every file in this batch…"
            rows={3}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Files <span className="text-[var(--accent)]">*</span>
            </label>
            {/* Resetting value after addFiles lets the same file be re-picked;
                addFiles snapshots the FileList first (see the note there). */}
            <input
              type="file"
              multiple
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-transparent
                px-3 py-2 text-sm text-[var(--text)]
                file:mr-3 file:rounded-[var(--r-sm)] file:border-0 file:bg-[var(--accent)]
                file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--solid-ink)]
                file:cursor-pointer cursor-pointer"
            />

            {cFiles.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5">
                {cFiles.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-[var(--r-sm)] border px-2.5 py-1.5"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>
                        {baseFileName(f.name)}
                      </p>
                      <p className="truncate text-[10px]" style={{ color: "var(--text-2)" }}>
                        {f.name} · {formatFileSize(f.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      title="Remove"
                      className="shrink-0 rounded-[var(--r-sm)] px-1.5 py-0.5 text-xs transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: "var(--text-2)" }}
                      disabled={saving}
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadProgress && (
              <p className="text-xs" style={{ color: "var(--text-2)" }}>
                Uploading {uploadProgress.done}/{uploadProgress.total}…
              </p>
            )}
          </div>
        </div>
      );
    }

    if (!selected) return null;

    return (
      <div>
        <CDetailRow label="Description" value={selected.description} />
        <CDetailRow label="File Name"   value={selected.file_name} />
        <CDetailRow label="Size"        value={formatFileSize(selected.file_size)} />
        <CDetailRow label="Path"        value={selected.path} />
        <CDetailRow label="Created"     value={formatDate(selected.created_at)} />
        <CDetailRow label="Last updated" value={formatDate(selected.updated_at)} />
        <CDetailRow label="Created by"  value={selected.created_by} />
        <CDetailRow label="Updated by"  value={selected.updated_by} />
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
            disabled={cFiles.length === 0}
          >
            {cFiles.length > 1 ? `Upload ${cFiles.length} Files` : "Upload File"}
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
          <FaTrash size={13} /> Delete file
        </CButton>
      </div>
    );
  }

  const sidebarTitle =
    mode === "create" ? "Upload files" :
    selected ? selected.name : "";

  const sidebarSubtitle =
    mode === "create" ? "Choose one or more files — each is named after its own filename" :
    selected ? `${selected.file_name} · ${formatFileSize(selected.file_size)}` : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHead title="Files" context="CSV and Parquet files you can model without a database.">
        <div className="w-full sm:w-64">
          <CTextInput
            value={search}
            onChange={setSearch}
            placeholder="Search files…"
            icon={<FaSearch size={12} />}
          />
        </div>
        <CButton variant="primary" onClick={openCreate}>
          <FaPlus size={12} /> Upload files
        </CButton>
      </PageHead>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

      {pageError && <CAlert variant="error" message={pageError} className="mb-6" />}



      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20" style={{ color: "var(--text-3)" }}>
          <CSpinner size={18} />
          <span className=" text-[12px]">Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyBoard line={search ? `No files match “${search}”` : "No files yet"} hint={search ? "Check the spelling or clear the search." : "Upload a CSV or Parquet file to model it without a database."} />
      ) : (
        <Panel flush bodyClassName="flex flex-col">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="label px-3 py-2 text-left whitespace-nowrap"
                    style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((file, index) => (
                <tr
                  key={file.id}
                  className="cursor-pointer transition-[filter] hover:brightness-[1.35]"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  onClick={() => openView(file)}
                >
                  <td className="mono px-3 py-2.5 text-[12px]" style={{ color: "var(--accent)" }}>
                    {index + 1}
                  </td>
                  <td className="font-medium px-3 py-2.5 text-[13px]">{file.name}</td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color: "var(--text-3)" }}>{file.file_name}</td>
                  <td className=" px-3 py-2.5 text-[11px]" style={{ color: "var(--text-2)" }}>{file.extension || "—"}</td>
                  <td className="mono px-3 py-2.5 text-[12px]">{formatFileSize(file.file_size)}</td>
                  <td className="mono whitespace-nowrap px-3 py-2.5 text-[12px]">{formatDate(file.created_at)}</td>
                  <td className=" px-3 py-2.5 text-[11px]" style={{ color: "var(--text-2)" }}>{file.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <BoardFill />
        </Panel>
      )}

      <CDialog
        isOpen={isSidebarOpen}
        onClose={closePanel}
        title={sidebarTitle}
        subtitle={sidebarSubtitle}
        footer={renderSidebarFooter()}
        closeOnBackdropClick={mode !== "create"}
      >
        {renderSidebarContent()}
      </CDialog>

      <CConfirmDialog
        isOpen={confirmOpen}
        title="Delete file"
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
    </div>  );
}
