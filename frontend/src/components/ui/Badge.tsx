import { CheckCircle2, CircleOff } from 'lucide-react'

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
        ? 'text-green-400 bg-green-400/10 border-green-400/20'
        : 'text-white/30 bg-white/5 border-white/10'
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
export function ColorBadge({ label, colorCls = 'text-white/40 bg-white/5 border-white/10' }: ColorBadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border font-medium ${colorCls}`}>
      {label}
    </span>
  )
}
