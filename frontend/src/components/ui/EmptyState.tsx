interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-12' : 'py-24'}`}>
      <div className={`${compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'} rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center`}>
        <span className="text-gray-400 dark:text-white/20">{icon}</span>
      </div>
      <h3 className={`font-semibold mb-1 ${compact ? 'text-sm text-gray-500 dark:text-white/40' : 'text-lg text-gray-600 dark:text-white/60'}`}>{title}</h3>
      {description && <p className="text-gray-400 dark:text-white/30 text-sm mb-6">{description}</p>}
      {action}
    </div>
  )
}
