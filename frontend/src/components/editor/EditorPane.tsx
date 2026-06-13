import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Save, AlertCircle, X, File as FileLucide } from '../../lib/icons'
import { Spinner } from '../ui/Spinner'
import { FileIcon, fileLang } from './FileIcon'
import { JsonHighlight } from './JsonHighlight'
import type { PackageFile } from '../../lib/api'

interface EditorPaneProps {
  selectedFile: PackageFile | null
  fileContents: Record<string, string>
  unsavedFiles: Record<string, boolean>
  savingFile: boolean
  saveError: string
  loadingContent: boolean
  copied: boolean
  onCopy: (text: string) => void
  onSave: () => void
  onContentChange: (filename: string, content: string) => void
  onSaveErrorDismiss: () => void
  buildPreview: (file: PackageFile) => string
}

export function EditorPane({
  selectedFile,
  fileContents,
  unsavedFiles,
  savingFile,
  saveError,
  loadingContent,
  copied,
  onCopy,
  onSave,
  onContentChange,
  onSaveErrorDismiss,
  buildPreview,
}: EditorPaneProps) {
  function editorContent(file: PackageFile): string {
    if (file.file.endsWith('.malloy')) return fileContents[file.file] ?? ''
    return buildPreview(file)
  }

  return (
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

              {/* Save button */}
              {selectedFile.model_id && unsavedFiles[selectedFile.file] && (
                <button
                  onClick={onSave}
                  disabled={savingFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-lg text-xs font-semibold text-black bg-yellow-400 hover:bg-yellow-300 transition-all disabled:opacity-50"
                >
                  {savingFile
                    ? <Spinner size="xs" className="border-black/20 border-t-black" />
                    : <Save className="w-3.5 h-3.5" />
                  }
                  {savingFile ? 'Saving…' : 'Save'}
                </button>
              )}

              {/* Copy button */}
              <button
                onClick={() => onCopy(editorContent(selectedFile))}
                className="flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-lg text-xs text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
              >
                {copied
                  ? <Check className="w-3.5 h-3.5 text-green-500" />
                  : <Copy className="w-3.5 h-3.5" />
                }
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Save error banner */}
            {saveError && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex-shrink-0">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {saveError}
                <button onClick={onSaveErrorDismiss} className="ml-auto text-red-400 hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Body */}
            {selectedFile.file.endsWith('.malloy') ? (
              loadingContent ? (
                <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#1e1e1e]">
                  <div className="flex flex-col items-center gap-2">
                    <Spinner size="md" className="border-yellow-400/30 border-t-yellow-400" />
                    <p className="text-xs text-gray-400 dark:text-white/30">Loading…</p>
                  </div>
                </div>
              ) : (
                <textarea
                  className="flex-1 resize-none w-full p-5 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white/80 font-mono text-xs outline-none leading-6 border-0"
                  value={fileContents[selectedFile.file] ?? ''}
                  onChange={e => onContentChange(selectedFile.file, e.target.value)}
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
  )
}
