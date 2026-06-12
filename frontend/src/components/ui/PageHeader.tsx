interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-8 ${className}`}>
      <div>
        <h1 className="text-2xl font-black text-white mb-1">{title}</h1>
        {description && <p className="text-white/40 text-sm">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
