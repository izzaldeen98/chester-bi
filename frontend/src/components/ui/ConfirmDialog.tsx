import { AlertCircle } from '../../lib/icons'

interface ConfirmDialogProps {
  /** Icon element rendered inside the badge */
  icon: React.ReactNode
  /** Tailwind classes for the icon container background/border */
  iconCls?: string
  title: string
  description: React.ReactNode
  /** Optional inline error message shown above the footer */
  error?: string
  /** Action buttons — rendered in a flex row */
  footer: React.ReactNode
}

/**
 * Standardised body for confirmation-style modals.
 * Wrap with <Modal> to get the animated backdrop + panel.
 *
 * Layout:  [icon badge]  title / description
 *          optional error banner
 *          footer (action buttons)
 */
export function ConfirmDialog({ icon, iconCls, title, description, error, footer }: ConfirmDialogProps) {
  return (
    <div className="px-6 py-5">
      {/* Icon + text */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls ?? 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'}`}>
          {icon}
        </div>
        <div>
          <p className="text-gray-900 dark:text-white font-bold text-sm">{title}</p>
          <div className="text-gray-500 dark:text-white/40 text-xs mt-0.5">{description}</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2">{footer}</div>
    </div>
  )
}
