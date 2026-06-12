import { Search, Plus, Trash2, AlertCircle, CheckCircle2, Play } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import { FileIcon } from './FileIcon'
import type { PackageFile } from '../../lib/api'

interface FileTreeSidebarProps {
  pkgName: string
  files: PackageFile[]
  selectedFile: PackageFile | null
  unsavedFiles: Record<string, boolean>
  fileSearch: string
  onSearchChange: (v: string) => void
  onFileSelect: (f: PackageFile) => void
  onDeleteClick: (f: PackageFile) => void
  onAddClick: () => void
  loadingPackage: boolean
  loadPackageStatus: 'idle' | 'success' | 'error'
  loadPackageMsg: string
  onLoadPackage: () => void
}

export function FileTreeSidebar({
  pkgName,
  files,
  selectedFile,
  unsavedFiles,
  fileSearch,
  onSearchChange,
  onFileSelect,
  onDeleteClick,
  onAddClick,
  loadingPackage,
  loadPackageStatus,
  loadPackageMsg,
  onLoadPackage,
}: FileTreeSidebarProps) {
  const filtered = files.filter(f =>
    f.file.toLowerCase().includes(fileSearch.toLowerCase()),
  )

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-gray-50 dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-white/10">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-widest">
            Explorer — {pkgName}
          </p>
          <button
            onClick={onAddClick}
            title="Add semantic model"
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 dark:text-white/30 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search files…"
            value={fileSearch}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-yellow-400 transition-colors"
          />
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-gray-400 dark:text-white/25 py-6 italic px-3">
            No files found
          </p>
        ) : (
          filtered.map(f => (
            <div
              key={f.file}
              className={`group flex items-center gap-2 px-3 py-2 text-xs transition-colors border-l-2 ${
                selectedFile?.file === f.file
                  ? 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border-yellow-400'
                  : 'text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-transparent'
              }`}
            >
              <button
                onClick={() => onFileSelect(f)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <FileIcon filename={f.file} active={selectedFile?.file === f.file} />
                <span className="flex-1 truncate font-medium">{f.file}</span>
              </button>

              {unsavedFiles[f.file] && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" title="Unsaved changes" />
              )}

              {f.model_id && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteClick(f) }}
                  title="Delete file"
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 dark:text-white/20 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-200 dark:border-white/10 space-y-2">
        <button
          onClick={onLoadPackage}
          disabled={loadingPackage}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${
            loadPackageStatus === 'success'
              ? 'bg-green-400/15 border border-green-400/30 text-green-500 dark:text-green-400'
              : loadPackageStatus === 'error'
              ? 'bg-red-400/10 border border-red-400/20 text-red-500 dark:text-red-400'
              : 'bg-yellow-400 text-black hover:bg-yellow-300 border border-transparent'
          }`}
        >
          {loadingPackage ? (
            <Spinner size="xs" className="border-black/20 border-t-black" />
          ) : loadPackageStatus === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : loadPackageStatus === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {loadingPackage
            ? 'Loading…'
            : loadPackageStatus === 'success'
            ? 'Loaded!'
            : loadPackageStatus === 'error'
            ? 'Failed'
            : 'Load Package'}
        </button>

        {loadPackageMsg && loadPackageStatus !== 'idle' && (
          <p className={`text-[10px] text-center leading-tight ${
            loadPackageStatus === 'error' ? 'text-red-400' : 'text-gray-400 dark:text-white/30'
          }`}>
            {loadPackageMsg}
          </p>
        )}

        <p className="text-[10px] text-gray-400 dark:text-white/25">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </p>
      </div>
    </aside>
  )
}
