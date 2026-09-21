import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaChevronLeft, FaFileAlt, FaFileCode, FaFileDownload, FaFileUpload, FaPlus, FaSave } from "react-icons/fa";
import { MdRefresh } from "react-icons/md";
import { VscJson } from "react-icons/vsc";
import { GoPackage } from "react-icons/go";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";
import CSpinner from "../components/CSpinner";
import CAlert from "../components/CAlert";
import CButton from "../components/CButton";
import CTextInput from "../components/CTextInput";
import CubeDefinitionWizard from "../components/CubeDefinitionWizard";
import { useTheme } from "../lib/theme";
import {
  listModelFiles,
  getDefinitionFileContent,
  saveDefinitionFile,
  addDefinition,
  loadModel,
  type DefinitionFile,
} from "../lib/Api";

type BuilderView = "code" | "wizard";

// ── File icon ──────────────────────────────────────────────────────────────
function FileIcon({ name, active }: { name: string; active: boolean }) {
  const inv = active ? "var(--solid-ink)" : undefined;
  if (name.endsWith(".json"))          return <VscJson    size={14} style={{ color: active ? inv : "var(--accent)"  }} />;
  if (name.endsWith(".yml") || name.endsWith(".yaml")) return <FaFileCode size={13} style={{ color: active ? inv : "var(--text-3)"        }} />;
  return                                      <FaFileAlt  size={13} style={{ color: active ? inv : "var(--text-2)"    }} />;
}

// ── Add File Dialog ────────────────────────────────────────────────────────
interface AddFileDialogProps {
  onConfirm: (name: string, filename: string, description: string, content: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string;
}
function AddFileDialog({ onConfirm, onCancel, saving, error }: AddFileDialogProps) {
  const [name,        setName]        = useState("");
  const [filename,    setFilename]    = useState("");
  const [description, setDescription] = useState("");
  const [content,     setContent]     = useState("");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onCancel}
      />
      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--r-sm)] p-6 shadow-xl flex flex-col gap-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>Add New File</h2>

        {error && <CAlert variant="error" message={error} />}

        <div className="flex gap-3">
          <CTextInput
            label="Definition Name"
            value={name}
            onChange={setName}
            placeholder="e.g. orders"
            required
            className="flex-1"
          />
          <CTextInput
            label="File Name"
            value={filename}
            onChange={setFilename}
            placeholder="e.g. orders.yml"
            required
            className="flex-1"
          />
        </div>
        <CTextInput
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Optional description"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Initial Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder="# Write your Cube definition here (cubes: [...])"
            className="w-full resize-y rounded-[var(--r-sm)] border bg-[var(--surface)] px-3.5 py-2.5 font-mono text-xs
              text-[var(--text)] placeholder:text-[var(--text-2)]
              outline-none transition-all
              focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]
              border-[var(--border)]"
          />
        </div>

        <div className="flex gap-2">
          <CButton
            variant="primary"
            fullWidth
            loading={saving}
            disabled={!name.trim() || !filename.trim()}
            onClick={() => onConfirm(name, filename, description, content)}
          >
            <FaPlus size={12} /> Add File
          </CButton>
          <CButton variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </CButton>
        </div>
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ModelEditorPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();

  // File list
  const [files, setFiles]         = useState<DefinitionFile[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]   = useState("");

  // Active file & content
  const [activeFile,     setActiveFile]     = useState<DefinitionFile | null>(null);
  const [content,        setContent]        = useState("");
  const [savedContent,   setSavedContent]   = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError,   setContentError]   = useState("");
  const isDirty = content !== savedContent;

  // Saving
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState("");
  const [saveOk,     setSaveOk]     = useState(false);

  // Load model
  const [loading,    setLoadingModel] = useState(false);
  const [loadResult, setLoadResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Add file dialog
  const [showAdd,    setShowAdd]    = useState(false);
  const [addSaving,  setAddSaving]  = useState(false);
  const [addError,   setAddError]   = useState("");

  // Code <-> Wizard navigation, and import
  const [builderView, setBuilderView] = useState<BuilderView>("code");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const saveOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch file list ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!modelId) return;
    fetchFiles();
  }, [modelId]);

  async function fetchFiles() {
    setListLoading(true); setListError("");
    try { setFiles(await listModelFiles(modelId!)); }
    catch (e: any) { setListError(e.message ?? "Failed to load files."); }
    finally { setListLoading(false); }
  }

  // ── Open a file ──────────────────────────────────────────────────────────
  async function openFile(f: DefinitionFile) {
    if (activeFile?.file === f.file) return;
    setActiveFile(f); setContent(""); setSavedContent(""); setContentError(""); setSaveError(""); setSaveOk(false);
    setBuilderView("code");
    if (!f.definition_id) return;
    setContentLoading(true);
    try {
      const text = await getDefinitionFileContent(f.definition_id);
      setContent(text); setSavedContent(text);
    } catch (e: any) { setContentError(e.message ?? "Failed to load file."); }
    finally { setContentLoading(false); }
  }

  // ── Wizard -> Code ────────────────────────────────────────────────────────
  // The wizard is the source of truth while it's open — the Code tab just
  // shows whatever it has generated so far, live.
  function handleWizardChange(cubeYaml: string) {
    setContent(cubeYaml);
  }

  // ── Export current file as .yml ───────────────────────────────────────────
  function handleExport() {
    if (!activeFile) return;
    const filename = activeFile.file.endsWith(".yml") ? activeFile.file : `${activeFile.file || "definition"}.yml`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Import a .yml file into the current editor ──────────────────────────
  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    if (isDirty && !window.confirm("This will replace your unsaved changes with the imported file's content. Continue?")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result ?? ""));
      setBuilderView("code");
    };
    reader.readAsText(file);
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!activeFile?.definition_id || !isDirty) return;
    setSaving(true); setSaveError(""); setSaveOk(false);
    try {
      await saveDefinitionFile(activeFile.definition_id, content, activeFile.file);
      setSavedContent(content); setSaveOk(true);
      if (saveOkTimer.current) clearTimeout(saveOkTimer.current);
      saveOkTimer.current = setTimeout(() => setSaveOk(false), 3000);
    } catch (e: any) { setSaveError(e.message ?? "Save failed."); }
    finally { setSaving(false); }
  }

  // ── Load model ─────────────────────────────────────────────────────────
  async function handleLoad() {
    if (!modelId) return;
    setLoadingModel(true); setLoadResult(null);
    try {
      await loadModel(modelId);
      setLoadResult({ ok: true, msg: "Model loaded successfully." });
    } catch (e: any) { setLoadResult({ ok: false, msg: e.message ?? "Load failed." }); }
    finally { setLoadingModel(false); }
  }

  // ── Add new file ──────────────────────────────────────────────────────────
  async function handleAddFile(name: string, filename: string, description: string, content: string) {
    if (!modelId) return;
    setAddSaving(true); setAddError("");
    try {
      await addDefinition(modelId, name, content, filename, description || undefined);
      setShowAdd(false); setAddError("");
      await fetchFiles();
    } catch (e: any) { setAddError(e.message ?? "Failed to add file."); }
    finally { setAddSaving(false); }
  }

  // ── Keyboard shortcut Ctrl/Cmd+S ─────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeFile, content, savedContent]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--surface)" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <button
          onClick={() => navigate("/models")}
          className="flex items-center gap-1.5 rounded-[var(--r-sm)] px-2 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          style={{ color: "var(--text-2)" }}
        >
          <FaChevronLeft size={10} /> Models
        </button>
        <span style={{ color: "var(--border)" }}>/</span>
        <div className="flex items-center gap-2">
          <GoPackage size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Model Editor</span>
        </div>
        {activeFile && (
          <>
            <span style={{ color: "var(--border)" }}>/</span>
            <span className="text-xs" style={{ color: "var(--text-2)" }}>{activeFile.file}</span>
            {isDirty && (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} title="Unsaved changes" />
            )}
          </>
        )}
        <div className="flex-1" />

        {loadResult && (
          <span className={`text-xs font-medium ${loadResult.ok ? "text-[var(--ok)] dark:text-[var(--ok)]" : "text-[var(--danger)]"}`}>
            {loadResult.msg}
          </span>
        )}
        {saveOk && <span className="text-xs font-medium text-[var(--ok)] dark:text-[var(--ok)]">Saved!</span>}
        {saveError && <span className="text-xs font-medium text-[var(--danger)]">{saveError}</span>}

        <CButton
          variant="outline"
          loading={loading}
          onClick={handleLoad}
        >
          <MdRefresh size={14} /> Load Model
        </CButton>

        <CButton
          variant="primary"
          loading={saving}
          disabled={!activeFile?.definition_id || !isDirty}
          onClick={handleSave}
        >
          <FaSave size={13} /> Save
        </CButton>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── File sidebar ────────────────────────────────────────────── */}
        <aside
          className="flex w-56 shrink-0 flex-col overflow-y-auto"
          style={{ borderRight: "1px solid var(--border)", background: "var(--surface-2)" }}
        >
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
              Files
            </span>
            <button
              type="button"
              onClick={() => { setAddError(""); setShowAdd(true); }}
              title="Add new file"
              className="flex items-center justify-center rounded-[var(--r-sm)] p-1 transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              style={{ color: "var(--text-2)" }}
            >
              <FaPlus size={11} />
            </button>
          </div>

          <div className="flex-1 py-1">
            {listLoading ? (
              <div className="flex items-center justify-center py-8"><CSpinner size={20} /></div>
            ) : listError ? (
              <div className="p-3"><CAlert variant="error" message={listError} /></div>
            ) : files.length === 0 ? (
              <p className="px-3 py-4 text-xs" style={{ color: "var(--text-2)" }}>No files found.</p>
            ) : (
              files.map((f) => {
                const isActive = activeFile?.file === f.file;
                return (
                  <button
                    key={f.file}
                    type="button"
                    onClick={() => openFile(f)}
                    title={f.location}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
                    style={isActive ? { background: "var(--solid)", color: "var(--solid-ink)" } : { color: "var(--text-2)" }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--accent-soft)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = ""; }}
                  >
                    <span className="shrink-0"><FileIcon name={f.file} active={isActive} /></span>
                    <span className="truncate">{f.file}</span>
                    {f.definition_id && !isActive && (
                      <span className="ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        definition
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Editor area ─────────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
          {!activeFile ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <FaFileCode size={40} style={{ color: "var(--border)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Select a file to edit</p>
              <p className="text-xs" style={{ color: "var(--text-2)" }}>Click a file in the sidebar to open it here.</p>
            </div>
          ) : (
            <>
              {/* File tab bar */}
              <div
                className="flex shrink-0 items-center gap-3 px-4 py-2"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
              >
                <FileIcon name={activeFile.file} active={false} />
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{activeFile.file}</span>
                {isDirty && <span className="text-xs" style={{ color: "var(--accent)" }}>● unsaved</span>}

                {activeFile.definition_id && (
                  <div className="ml-2 flex items-center gap-0.5 rounded-[var(--r-sm)] border p-0.5" style={{ borderColor: "var(--border)" }}>
                    {(["code", "wizard"] as BuilderView[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBuilderView(v)}
                        className="rounded-[var(--r-sm)] px-2.5 py-1 text-[11px] font-medium capitalize transition-all"
                        style={builderView === v
                          ? { background: "var(--solid)", color: "var(--solid-ink)" }
                          : { color: "var(--text-2)" }}
                      >
                        {v === "wizard" ? "Visual Builder" : "Code"}
                      </button>
                    ))}
                  </div>
                )}

                <span className="ml-auto text-xs truncate" style={{ color: "var(--text-2)" }}>{activeFile.location}</span>

                {activeFile.definition_id && (
                  <>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".yml,.yaml"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      title="Import a .yml file into this editor"
                      className="flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] px-2 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                      style={{ color: "var(--text-2)" }}
                    >
                      <FaFileUpload size={11} /> Import
                    </button>
                    <button
                      type="button"
                      onClick={handleExport}
                      title="Export this definition as a .yml file"
                      className="flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] px-2 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                      style={{ color: "var(--text-2)" }}
                    >
                      <FaFileDownload size={11} /> Export
                    </button>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {contentLoading ? (
                  <div className="flex flex-1 items-center justify-center"><CSpinner size={24} /></div>
                ) : contentError ? (
                  <div className="p-4"><CAlert variant="error" message={contentError} /></div>
                ) : !activeFile.definition_id ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                    <VscJson size={32} style={{ color: "var(--border)" }} />
                    <p className="text-sm" style={{ color: "var(--text-2)" }}>Content preview is not available for this file.</p>
                  </div>
                ) : builderView === "wizard" ? (
                  <CubeDefinitionWizard initialCode={content} onChange={handleWizardChange} />
                ) : (
                  <CodeMirror
                    value={content}
                    onChange={setContent}
                    height="100%"
                    style={{ flex: 1, overflow: "hidden", fontSize: 13 }}
                    theme={theme === "dark" ? vscodeDark : EditorView.theme({
                      "&": { background: "var(--surface)", color: "var(--text)" },
                      ".cm-gutters": { background: "var(--surface-2)", borderRight: "1px solid var(--border)", color: "var(--text-2)" },
                      ".cm-activeLine": { background: "var(--accent-soft)" },
                      ".cm-activeLineGutter": { background: "var(--accent-soft)" },
                      ".cm-selectionBackground, ::selection": { background: "var(--accent-line) !important" },
                      ".cm-cursor": { borderLeftColor: "var(--accent)" },
                      ".cm-scroller": { fontFamily: "ui-monospace, Consolas, monospace" },
                    })}
                    extensions={
                      activeFile.file.endsWith(".json")
                        ? [json()]
                        : activeFile.file.endsWith(".yml") || activeFile.file.endsWith(".yaml")
                        ? [yaml()]
                        : []
                    }
                    basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, highlightSelectionMatches: true }}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Add file dialog ──────────────────────────────────────────────── */}
      {showAdd && (
        <AddFileDialog
          onConfirm={handleAddFile}
          onCancel={() => setShowAdd(false)}
          saving={addSaving}
          error={addError}
        />
      )}
    </div>
  );
}
