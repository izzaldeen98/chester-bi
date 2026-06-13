import { CheckCircle2, CircleOff } from '../../lib/icons'

// ── StatusBadge ───────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}

/** Green "Active" / muted "Inactive" pill with icon. */
export function StatusBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium ${
      active
        ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 border-green-200 dark:border-green-400/20'
        : 'text-gray-500 dark:text-white/30 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
    }`}>
      {active
        ? <CheckCircle2 className="w-3 h-3" />
        : <CircleOff className="w-3 h-3" />
      }
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

// ── ColorBadge ────────────────────────────────────────────────────────────────

interface ColorBadgeProps {
  label: string
  colorCls?: string
}

/** Generic coloured pill — pass Tailwind colour classes via colorCls. */
export function ColorBadge({ label, colorCls = 'text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10' }: ColorBadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border font-medium ${colorCls}`}>
      {label}
    </span>
  )
}
