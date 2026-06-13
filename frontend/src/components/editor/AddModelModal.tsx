import { Plus, X, AlertCircle } from '../../lib/icons'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'

interface AddModelModalProps {
  open: boolean
  loading: boolean
  error: string
  name: string
  description: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AddModelModal({
  open,
  loading,
  error,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onClose,
}: AddModelModalProps) {
  return (
    <Modal open={open} onClose={onClose} disabled={loading}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-500 dark:text-yellow-400">
            <Plus className="w-3.5 h-3.5" />
          </div>
          <p className="text-gray-900 dark:text-white font-bold text-sm">Add Semantic Model</p>
        </div>
        <button
          onClick={onClose}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">
            Model Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="e.g. revenue_model"
            required
            autoFocus
            disabled={loading}
            className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-yellow-400 transition-colors disabled:opacity-50"
          />
          <p className="text-[10px] text-gray-400 dark:text-white/25 mt-1 font-mono">
            {name.trim() || 'name'}.malloy
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-white/40 mb-1.5">
            Description <span className="text-gray-300 dark:text-white/20 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="What this model tracks…"
            disabled={loading}
            className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-yellow-400 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-white/40 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-yellow-400 text-black hover:bg-yellow-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <><Spinner size="xs" className="border-black/20 border-t-black" />Creating…</>
              : <><Plus className="w-3.5 h-3.5" />Create File</>
            }
          </button>
        </div>
      </form>
    </Modal>
  )
}
