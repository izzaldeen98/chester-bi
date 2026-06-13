import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, CheckCircle2, CircleOff, AlertCircle, Trash2, Save } from '../lib/icons'
import { packagesApi, semanticModelsApi } from '../lib/api'
import type { PackageResponse, PackageFile } from '../lib/api'

import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner } from '../components/ui/Spinner'
import { FileTreeSidebar } from '../components/editor/FileTreeSidebar'
import { EditorPane } from '../components/editor/EditorPane'
import { AddModelModal } from '../components/editor/AddModelModal'

export default function PackageDetailPage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useNavigate()

  // ── Package & file list ────────────────────────────────────────────────────
  const [pkg, setPkg]         = useState<PackageResponse | null>(null)
  const [files, setFiles]     = useState<PackageFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // ── Editor state ───────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile]     = useState<PackageFile | null>(null)
  const [fileSearch, setFileSearch]         = useState('')
  const [fileContents, setFileContents]     = useState<Record<string, string>>({})
  const [unsavedFiles, setUnsavedFiles]     = useState<Record<string, boolean>>({})
  const [loadingContent, setLoadingContent] = useState(false)
  const [copied, setCopied]                 = useState(false)

  // ── Save state ─────────────────────────────────────────────────────────────
  const [savingFile, setSavingFile] = useState(false)
  const [saveError, setSaveError]   = useState('')

  // ── Switch-away guard ──────────────────────────────────────────────────────
  const [switchTarget, setSwitchTarget] = useState<PackageFile | null>(null)

  // ── Load package ───────────────────────────────────────────────────────────
  const [loadingPackage, setLoadingPackage]           = useState(false)
  const [loadPackageStatus, setLoadPackageStatus]     = useState<'idle' | 'success' | 'error'>('idle')
  const [loadPackageMsg, setLoadPackageMsg]           = useState('')

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PackageFile | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState('')

  // ── Add model modal ────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName]           = useState('')
  const [addDesc, setAddDesc]           = useState('')
  const [addLoading, setAddLoading]     = useState(false)
  const [addError, setAddError]         = useState('')

  // ── Effects ────────────────────────────────────────────────────────────────

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

  // Warn browser on unload when there are unsaved changes
  useEffect(() => {
    const anyUnsaved = Object.values(unsavedFiles).some(Boolean)
    const handler = (e: BeforeUnloadEvent) => {
      if (anyUnsaved) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [unsavedFiles])

  // Fetch file content when a .malloy file is selected and not yet cached
  useEffect(() => {
    if (!selectedFile?.model_id) return
    if (fileContents[selectedFile.file] !== undefined) return

    let cancelled = false
    setLoadingContent(true)
    semanticModelsApi.getContent(selectedFile.model_id)
      .then(({ content }) => {
        if (!cancelled) setFileContents(prev => ({ ...prev, [selectedFile!.file]: content }))
      })
      .catch(() => {
        if (!cancelled) setFileContents(prev => ({ ...prev, [selectedFile!.file]: '' }))
      })
      .finally(() => { if (!cancelled) setLoadingContent(false) })

    return () => { cancelled = true }
  }, [selectedFile])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleFileSelect(target: PackageFile) {
    if (selectedFile && unsavedFiles[selectedFile.file] && target.file !== selectedFile.file) {
      setSwitchTarget(target)
    } else {
      setSelectedFile(target)
      setSaveError('')
    }
  }

  function handleContentChange(filename: string, content: string) {
    setFileContents(prev => ({ ...prev, [filename]: content }))
    setUnsavedFiles(prev => ({ ...prev, [filename]: true }))
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function doSave(file: PackageFile) {
    if (!file.model_id) return
    setSavingFile(true); setSaveError('')
    try {
      await semanticModelsApi.save(file.model_id, fileContents[file.file] ?? '', file.file)
      setUnsavedFiles(prev => ({ ...prev, [file.file]: false }))
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      throw err
    } finally {
      setSavingFile(false)
    }
  }

  async function handleSave() {
    if (selectedFile) await doSave(selectedFile).catch(() => {})
  }

  async function handleSaveAndSwitch() {
    if (!selectedFile || !switchTarget) return
    try {
      await doSave(selectedFile)
      setSelectedFile(switchTarget)
    } finally {
      setSwitchTarget(null)
    }
  }

  function handleDiscardAndSwitch() {
    if (!switchTarget) return
    setUnsavedFiles(prev => ({ ...prev, [selectedFile!.file]: false }))
    setSelectedFile(switchTarget)
    setSwitchTarget(null)
    setSaveError('')
  }

  async function handleAddModel(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim() || !packageId) return
    try {
      setAddLoading(true); setAddError('')
      const fileName = `${addName.trim()}.malloy`
      const fileBlob = new File([''], fileName, { type: 'text/plain' })
      await semanticModelsApi.add(addName.trim(), packageId, fileBlob, addDesc.trim() || undefined)
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

  async function handleDelete() {
    if (!deleteTarget?.model_id) return
    setDeleting(true); setDeleteError('')
    try {
      await semanticModelsApi.delete(deleteTarget.model_id)
      setFileContents(prev => { const n = { ...prev }; delete n[deleteTarget.file]; return n })
      setUnsavedFiles(prev => { const n = { ...prev }; delete n[deleteTarget.file]; return n })
      if (selectedFile?.file === deleteTarget.file) setSelectedFile(null)
      const updated = await packagesApi.listFiles(packageId!)
      setFiles(updated)
      setDeleteTarget(null)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  async function handleLoadPackage() {
    if (!packageId) return
    setLoadingPackage(true); setLoadPackageStatus('idle'); setLoadPackageMsg('')
    try {
      const res = await packagesApi.loadPackage(packageId)
      setLoadPackageStatus('success')
      setLoadPackageMsg(res.message ?? 'Package loaded successfully')
    } catch (err: unknown) {
      setLoadPackageStatus('error')
      setLoadPackageMsg(err instanceof Error ? err.message : 'Failed to load package')
    } finally {
      setLoadingPackage(false)
      setTimeout(() => setLoadPackageStatus('idle'), 4000)
    }
  }

  function buildPreview(file: PackageFile): string {
    return JSON.stringify({
      file: file.file,
      location: file.location,
      package_id: packageId,
      package_name: pkg?.name ?? '',
    }, null, 2)
  }

  // ── Loading / error screens ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" className="border-yellow-400/30 border-t-yellow-400" />
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
                {pkg.is_active
                  ? <><CheckCircle2 className="w-2.5 h-2.5" />Active</>
                  : <><CircleOff className="w-2.5 h-2.5" />Inactive</>
                }
              </span>
            </div>
            <p className="text-gray-400 dark:text-white/30 text-xs font-mono truncate">{pkg.id}</p>
          </div>
        </div>
      </div>

      {/* Editor layout */}
      <div className="flex gap-0 flex-1 min-h-0 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
        <FileTreeSidebar
          pkgName={pkg.name}
          files={files}
          selectedFile={selectedFile}
          unsavedFiles={unsavedFiles}
          fileSearch={fileSearch}
          onSearchChange={setFileSearch}
          onFileSelect={handleFileSelect}
          onDeleteClick={f => { setDeleteTarget(f); setDeleteError('') }}
          onAddClick={() => { setAddName(''); setAddDesc(''); setAddError(''); setShowAddModal(true) }}
          loadingPackage={loadingPackage}
          loadPackageStatus={loadPackageStatus}
          loadPackageMsg={loadPackageMsg}
          onLoadPackage={handleLoadPackage}
        />

        <EditorPane
          selectedFile={selectedFile}
          fileContents={fileContents}
          unsavedFiles={unsavedFiles}
          savingFile={savingFile}
          saveError={saveError}
          loadingContent={loadingContent}
          copied={copied}
          onCopy={handleCopy}
          onSave={handleSave}
          onContentChange={handleContentChange}
          onSaveErrorDismiss={() => setSaveError('')}
          buildPreview={buildPreview}
        />
      </div>

      {/* ── Add Model Modal ── */}
      <AddModelModal
        open={showAddModal}
        loading={addLoading}
        error={addError}
        name={addName}
        description={addDesc}
        onNameChange={setAddName}
        onDescriptionChange={setAddDesc}
        onSubmit={handleAddModel}
        onClose={() => setShowAddModal(false)}
      />

      {/* ── Delete Confirmation ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        disabled={deleting}
        maxWidth="max-w-sm"
      >
        <ConfirmDialog
          icon={<Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />}
          iconCls="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
          title="Delete file?"
          description={
            <>
              <span className="font-mono text-gray-700 dark:text-white/60">{deleteTarget?.file}</span>
              {' '}will be permanently removed from storage. This cannot be undone.
            </>
          }
          error={deleteError}
          footer={
            <>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-white/40 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting
                  ? <Spinner size="xs" className="border-white/30 border-t-white" />
                  : <Trash2 className="w-3 h-3" />
                }
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        />
      </Modal>

      {/* ── Unsaved Changes Warning ── */}
      <Modal
        open={!!switchTarget}
        onClose={() => setSwitchTarget(null)}
        maxWidth="max-w-sm"
      >
        <ConfirmDialog
          icon={<AlertCircle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />}
          iconCls="bg-yellow-400/15 border border-yellow-400/20"
          title="Unsaved changes"
          description={
            <>
              <span className="font-mono text-gray-700 dark:text-white/60">{selectedFile?.file}</span>
              {' '}has unsaved changes. Save before switching?
            </>
          }
          footer={
            <>
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
                  ? <Spinner size="xs" className="border-black/20 border-t-black" />
                  : <Save className="w-3 h-3" />
                }
                Save &amp; Switch
              </button>
            </>
          }
        />
      </Modal>

    </div>
  )
}
