import { AlertCircle, X } from '../../lib/icons'

interface ErrorBannerProps {
  message: string
  onDismiss?: () => void
  className?: string
}

export function ErrorBanner({ message, onDismiss, className = '' }: ErrorBannerProps) {
  if (!message) return null
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm ${className}`}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400/60 hover:text-red-400 transition-colors ml-1">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
