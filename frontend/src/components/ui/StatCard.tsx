interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1 text-white/40">
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  )
}

interface StatsGridProps {
  stats: { label: string; value: number | string; icon: React.ReactNode }[]
  cols?: 2 | 3 | 4
  className?: string
}

export function StatsGrid({ stats, cols = 3, className = '' }: StatsGridProps) {
  const colCls = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[cols]
  return (
    <div className={`grid ${colCls} gap-4 mb-8 ${className}`}>
      {stats.map((s) => <StatCard key={s.label} {...s} />)}
    </div>
  )
}
