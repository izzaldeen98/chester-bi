interface DetailRowProps {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}

export function DetailRow({ icon, label, value, mono }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 dark:text-white/25 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-gray-500 dark:text-white/40 text-xs mb-0.5">{label}</p>
        <p className={`text-gray-900 dark:text-white text-sm break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      </div>
    </div>
  )
}
