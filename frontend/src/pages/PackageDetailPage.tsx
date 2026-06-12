import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Package, FileJson, File as FileLucide, AlertCircle,
  Search, CheckCircle2, CircleOff, Copy, Check, Plus, X, Save,
} from 'lucide-react'
import { packagesApi, semanticModelsApi } from '../lib/api'
import type { PackageResponse, PackageFile } from '../lib/api'

function FileIcon({ filename, active = false }: { filename: string; active?: boolean }) {
  const cls = active ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-white/40'
  if (filename.endsWith('.json'))   return <FileJson className={`w-4 h-4 ${cls}`} />
  if (filename.endsWith('.malloy')) return <FileLucide className={`w-4 h-4 ${active ? 'text-purple-400' : 'text-purple-400/50'}`} />
  return <FileLucide className={`w-4 h-4 ${cls}`} />
}

function fileLang(filename: string): string {
  if (filename.endsWith('.malloy')) return 'Malloy'
  if (filename.endsWith('.json'))   return 'JSON'
  return 'Text'
}

// Syntax-highlights a JSON string into spans
function JsonHighlight({ raw }: { raw: string }) {
  const lines = raw.split('\n')
  return (
    <code className="block text-xs leading-6 font-mono">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {/* line number */}
          <span className="select-none inline-block w-10 text-right pr-4 text-gray-400 dark:text-white/20 border-r border-gray-200 dark:border-white/10 mr-4">
            {i + 1}
          </span>
          <HighlightedLine line={line} />
        </span>
      ))}
    </code>
  )
}

function HighlightedLine({ line }: { line: string }) {
  // simple tokenizer for JSON highlighting
  const tokens: { text: string; cls: string }[] = []
  let rest = line

  const keyRe   = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:)/
  const strRe   = /^("(?:[^"\\]|\\.)*")/
  const numRe   = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/
  const boolRe  = /^(true|false|null)/
  const punctRe = /^([{}\[\],])/
  const spaceRe = /^(\s+)/

  while (rest.length > 0) {
    let m: RegExpMatchArray | null

    if ((m = rest.match(keyRe))) {
      tokens.push({ text: m[1], cls: '' })
      tokens.push({ text: m[2], cls: 'text-blue-500 dark:text-blue-300' })
      tokens.push({ text: m[3], cls: 'text-gray-500 dark:text-white/50' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(strRe))) {
      tokens.push({ text: m[1], cls: 'text-green-600 dark:text-green-400' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(numRe))) {
      tokens.push({ text: m[1], cls: 'text-orange-500 dark:text-orange-300' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(boolRe))) {
      tokens.push({ text: m[1], cls: 'text-purple-500 dark:text-purple-300' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(punctRe))) {
      tokens.push({ text: m[1], cls: 'text-gray-500 dark:text-white/50' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(spaceRe))) {
      tokens.push({ text: m[1], cls: '' })
      rest = rest.slice(m[0].length)
    } else {
      tokens.push({ text: rest[0], cls: 'text-gray-700 dark:text-white/70' })
      rest = rest.slice(1)
    }
  }

  return (
    <>
      {tokens.map((t, i) => (
        t.cls ? <span key={i} className={t.cls}>{t.text}</span> : <span key={i}>{t.text}</span>
      ))}
    </>
  )
}

export default function PackageDetailPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()

  const [pkg, setPkg]             = useState<PackageResponse | null>(null)
  const [files, setFiles]         = useState<PackageFile[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [selectedFile, setSelectedFile] = useState<PackageFile | null>(null)
  const [fileSearch, setFileSearch]     = useState('')
  const [copied, setCopied]             = useState(false)

  // Per-file editable content keyed by filename
  const [fileContents, setFileContents]     = useState<Record<string, string>>({})
  // Tracks which .malloy files have unsaved changes
  const [unsavedFiles, setUnsavedFiles]     = useState<Record<string, boolean>>({})
  // Target file the user wants to switch to while current file is unsaved
  const [switchTarget, setSwitchTarget]     = useState<PackageFile | null>(null)
  // Save state
  const [savingFile, setSavingFile]         = useState(false)
  const [saveError, setSaveError]           = useState('')
  // Content loading state per file
  const [loadingContent, setLoadingContent] = useState(false)

  // Add semantic model modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName]           = useState('')
  const [addDesc, setAddDesc]           = useState('')
  const [addLoading, setAddLoading]     = useState(false)
  const [addError, setAddError]         = useState('')

  useEffect(() => {
    if (!packageId) return
    async function load() {
      try {
        setLoading(true); setError('')
        const [pkgData, filesData] = await Promise.all([
          packagesApi.get(packageId!),
          packagesApi.listFiles(packageId!),
        ])
        setPkg(pkgData)
        setFiles(filesData)
        if (filesData.length > 0) setSelectedFile(filesData[0])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load package')
      } finally { setLoading(false) }
    }
    load()
  }, [packageId])

  // Warn the browser before unloading if there are unsaved changes
  useEffect(() => {
    const anyUnsaved = Object.values(unsavedFiles).some(Boolean)
    const handler = (e: BeforeUnloadEvent) => {
      if (anyUnsaved) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [unsavedFiles])

  // Fetch file content from the server when a .malloy file is selected and not yet cached
  useEffect(() => {
    if (!selectedFile?.model_id) return
    if (fileContents[selectedFile.file] !== undefined) return  // already loaded

    let cancelled = false
    async function fetchContent() {
      setLoadingContent(true)
      try {
        const { content } = await semanticModelsApi.getContent(selectedFile!.model_id!)
        if (!cancelled) {
          setFileContents(prev => ({ ...prev, [selectedFile!.file]: content }))
        }
      } catch {
        if (!cancelled) {
          setFileContents(prev => ({ ...prev, [selectedFile!.file]: '' }))
        }
      } finally {
        if (!cancelled) setLoadingContent(false)
      }
    }
    fetchContent()
    return () => { cancelled = true }
  }, [selectedFile])

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function editorContent(file: PackageFile): string {
    if (file.file.endsWith('.malloy')) return fileContents[file.file] ?? ''
    return buildPreview(file)
  }

  // Try to switch to a file; if current file has unsaved changes, prompt first
  function handleFileSelect(target: PackageFile) {
    if (selectedFile && unsavedFiles[selectedFile.file] && target.file !== selectedFile.file) {
      setSwitchTarget(target)
    } else {
      setSelectedFile(target)
      setSaveError('')
    }
  }

  // Save & switch
  async function handleSaveAndSwitch() {
    if (!selectedFile || !switchTarget) return
    await doSave(selectedFile)
    setSelectedFile(switchTarget)
    setSwitchTarget(null)
    setSaveError('')
  }

  // Discard & switch
  function handleDiscardAndSwitch() {
    if (!switchTarget) return
    setUnsavedFiles(prev => ({ ...prev, [selectedFile!.file]: false }))
    setSelectedFile(switchTarget)
    setSwitchTarget(null)
    setSaveError('')
  }

  // Core save logic (can be called from the Save button or Save-and-Switch)
  async function doSave(file: PackageFile) {
    if (!file.model_id) return
    setSavingFile(true); setSaveError('')
    try {
      const content = fileContents[file.file] ?? ''
      await semanticModelsApi.save(file.model_id, content, file.file)
      setUnsavedFiles(prev => ({ ...prev, [file.file]: false }))
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      throw err  // re-throw so handleSaveAndSwitch knows it failed
    } finally {
      setSavingFile(false)
    }
  }

  async function handleSave() {
    if (selectedFile) await doSave(selectedFile).catch(() => {/* error shown in UI */})
  }

  async function handleAddModel(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim() || !packageId) return
    try {
      setAddLoading(true); setAddError('')
      const fileName = `${addName.trim()}.malloy`
      // Create an empty file; user will write content in the editor
      const fileBlob = new File([''], fileName, { type: 'text/plain' })
      await semanticModelsApi.add(addName.trim(), packageId, fileBlob, addDesc.trim() || undefined)
      // Reload files from the server and auto-select the new one
      const updated = await packagesApi.listFiles(packageId)
      setFiles(updated)
      const newEntry = updated.find(f => f.file === fileName)
      if (newEntry) setSelectedFile(newEntry)
      setFileContents(prev => ({ ...prev, [fileName]: '' }))
      setShowAddModal(false)
      setAddName(''); setAddDesc('')
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add model')
    } finally {
      setAddLoading(false)
    }
  }

  function openAddModal() {
    setAddName(''); setAddDesc(''); setAddError('')
    setShowAddModal(true)
  }

  const filteredFiles = files.filter((f) =>
    f.file.toLowerCase().includes(fileSearch.toLowerCase()),
  )

  // Build a fake JSON preview from location info
  function buildPreview(file: PackageFile): string {
    const preview = {
      file: file.file,
      location: file.location,
      package_id: packageId,
      package_name: pkg?.name ?? '',
    }
    return JSON.stringify(preview, null, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
          <p className="text-gray-400 dark:text-white/40 text-sm">Loading package…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <button
          onClick={() => navigate('/home/packages')}
          className="flex items-center gap-2 text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Packages
        </button>
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      </div>
    )
  }

  if (!pkg) return null

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem - 3rem)' }}>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-5 flex-shrink-0">
        <button
          onClick={() => navigate('/home/packages')}
          className="flex items-center gap-2 text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white text-sm transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-500 dark:text-yellow-400 flex-shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{pkg.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 flex-shrink-0 ${
                pkg.is_active
                  ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 border-green-200 dark:border-green-400/20'
                  : 'text-gray-400 dark:text-white/30 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
              }`}>
                {pkg.is_active ? <><CheckCircle2 className="w-2.5 h-2.5" />Active</> : <><CircleOff className="w-2.5 h-2.5" />Inactive</>}
              </span>
            </div>
            <p className="text-gray-400 dark:text-white/30 text-xs font-mono truncate">{pkg.id}</p>
          </div>
        </div>
      </div>

      {/* Editor layout */}
      <div className="flex gap-0 flex-1 min-h-0 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">

        {/* ── File tree sidebar ── */}
        <aside className="w-56 flex-shrink-0 flex flex-col bg-gray-50 dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-white/10">
          {/* Sidebar header */}
          <div className="px-3 py-3 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-widest">
                Explorer — {pkg.name}
              </p>
              <button
                onClick={openAddModal}
                title="Add semantic model"
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 dark:text-white/30 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-white/30 pointer-events-none" />
              <input
                type="text"
                placeholder="Search files…"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-yellow-400 transition-colors"
              />
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto py-1">
            {filteredFiles.length === 0 ? (
              <p className="text-center text-xs text-gray-400 dark:text-white/25 py-6 italic px-3">No files found</p>
            ) : (
              filteredFiles.map((f) => (
                <button
                  key={f.file}
                  onClick={() => handleFileSelect(f)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    selectedFile?.file === f.file
                      ? 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border-l-2 border-yellow-400'
                      : 'text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <FileIcon filename={f.file} active={selectedFile?.file === f.file} />
                  <span className="flex-1 truncate font-medium">{f.file}</span>
                  {unsavedFiles[f.file] && (
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" title="Unsaved changes" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-gray-200 dark:border-white/10">
            <p className="text-[10px] text-gray-400 dark:text-white/25">{files.length} file{files.length !== 1 ? 's' : ''}</p>
          </div>
        </aside>

        {/* ── Editor area ── */}
        <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#1e1e1e]">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key={selectedFile.file}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* Tab bar */}
                <div className="flex items-center border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#252526] flex-shrink-0">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-white/10 border-b-2 border-b-yellow-400">
                    <FileIcon filename={selectedFile.file} active />
                    <span className="text-xs font-medium text-gray-900 dark:text-white">{selectedFile.file}</span>
                    {unsavedFiles[selectedFile.file] && (
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex-1" />
                  {/* Save button — only for unsaved .malloy files */}
                  {selectedFile.model_id && unsavedFiles[selectedFile.file] && (
                    <button
                      onClick={handleSave}
                      disabled={savingFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-lg text-xs font-semibold text-black bg-yellow-400 hover:bg-yellow-300 transition-all disabled:opacity-50"
                    >
                      {savingFile
                        ? <div className="w-3 h-3 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                        : <Save className="w-3.5 h-3.5" />
                      }
                      {savingFile ? 'Saving…' : 'Save'}
                    </button>
                  )}
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(editorContent(selectedFile))}
                    className="flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-lg text-xs text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Save error banner */}
                {saveError && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex-shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {saveError}
                    <button onClick={() => setSaveError('')} className="ml-auto text-red-400 hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Code body */}
                {selectedFile.file.endsWith('.malloy') ? (
                  loadingContent ? (
                    <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#1e1e1e]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
                        <p className="text-xs text-gray-400 dark:text-white/30">Loading…</p>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      className="flex-1 resize-none w-full p-5 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white/80 font-mono text-xs outline-none leading-6 border-0"
                      value={fileContents[selectedFile.file] ?? ''}
                      onChange={e => {
                        setFileContents(prev => ({ ...prev, [selectedFile.file]: e.target.value }))
                        setUnsavedFiles(prev => ({ ...prev, [selectedFile.file]: true }))
                      }}
                      placeholder="// Start writing your Malloy model…"
                      spellCheck={false}
                    />
                  )
                ) : (
                  <div className="flex-1 overflow-auto p-5 bg-white dark:bg-[#1e1e1e]">
                    <JsonHighlight raw={buildPreview(selectedFile)} />
                  </div>
                )}

                {/* Status bar */}
                <div className="flex items-center gap-4 px-4 py-1.5 bg-yellow-400 text-black text-[10px] font-medium flex-shrink-0">
                  <span>{selectedFile.file}</span>
                  <span className="opacity-60">{fileLang(selectedFile.file)}</span>
                  {!selectedFile.file.endsWith('.malloy') && (
                    <span className="opacity-60 ml-auto">Read Only</span>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center bg-white dark:bg-[#1e1e1e]"
              >
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center mx-auto mb-3">
                    <FileLucide className="w-5 h-5 text-gray-300 dark:text-white/20" />
                  </div>
                  <p className="text-gray-400 dark:text-white/40 text-sm">Select a file from the explorer</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Unsaved Changes — Switch Confirmation ── */}
      <AnimatePresence>
        {switchTarget && (
          <>
            <motion.div
              key="sw-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setSwitchTarget(null)}
            />
            <motion.div
              key="sw-modal"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.16, type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-sm bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl pointer-events-auto overflow-hidden">
                <div className="px-6 py-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white font-bold text-sm">Unsaved changes</p>
                      <p className="text-gray-500 dark:text-white/40 text-xs mt-0.5">
                        <span className="font-mono text-gray-700 dark:text-white/60">{selectedFile?.file}</span> has unsaved changes. Save before switching?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSwitchTarget(null)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-white/40 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDiscardAndSwitch}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                    >
                      Discard &amp; Switch
                    </button>
                    <button
                      onClick={handleSaveAndSwitch}
                      disabled={savingFile}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-yellow-400 text-black hover:bg-yellow-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {savingFile
                        ? <div className="w-3 h-3 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                        : <Save className="w-3 h-3" />
                      }
                      Save &amp; Switch
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Add Semantic Model Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => !addLoading && setShowAddModal(false)}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-md bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl pointer-events-auto overflow-hidden">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-500 dark:text-yellow-400">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-bold text-sm">Add Semantic Model</p>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    disabled={addLoading}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal body */}
                <form onSubmit={handleAddModel} className="px-6 py-5 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">
                      Model Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      placeholder="e.g. revenue_model"
                      required
                      autoFocus
                      disabled={addLoading}
                      className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-yellow-400 transition-colors disabled:opacity-50"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-white/25 mt-1 font-mono">
                      {addName.trim() || 'name'}.malloy
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">
                      Description <span className="text-gray-300 dark:text-white/20 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={addDesc}
                      onChange={e => setAddDesc(e.target.value)}
                      placeholder="What this model tracks…"
                      disabled={addLoading}
                      className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-yellow-400 transition-colors disabled:opacity-50"
                    />
                  </div>

                  {/* Error */}
                  {addError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {addError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      disabled={addLoading}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-white/40 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addLoading || !addName.trim()}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold bg-yellow-400 text-black hover:bg-yellow-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {addLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Create File
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
