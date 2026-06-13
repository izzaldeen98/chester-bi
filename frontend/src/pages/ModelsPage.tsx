import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BrainCircuit, CheckCircle2, Table2, Plus, ChevronRight,
  CalendarDays, Tag, BarChart3,
} from '../lib/icons'
import { AppButton } from '../components/ui/AppButton'
import { PageHeader } from '../components/ui/PageHeader'
import { StatsGrid } from '../components/ui/StatCard'
import { SlidePanel } from '../components/ui/SlidePanel'
import { DetailRow } from '../components/ui/DetailRow'
import { StatusBadge, ColorBadge } from '../components/ui/Badge'

interface Model {
  name: string
  type: string
  tables: number
  status: string
  updated: string
  description?: string
}

const mockModels: Model[] = [
  { name: 'Revenue Model',     type: 'Financial',  tables: 4, status: 'Active', updated: '2026-06-10', description: 'Tracks revenue across all sales channels and regions, including MRR, ARR, and churn metrics.' },
  { name: 'User Behavior',     type: 'Analytics',  tables: 7, status: 'Active', updated: '2026-06-09', description: 'Analyzes user engagement patterns, retention cohorts, and feature adoption.' },
  { name: 'Inventory Metrics', type: 'Operations', tables: 3, status: 'Draft',  updated: '2026-06-08', description: 'Monitors stock levels, reorder points, and supply chain efficiency.' },
  { name: 'Marketing Funnel',  type: 'Marketing',  tables: 5, status: 'Active', updated: '2026-06-07', description: 'Full-funnel attribution from first touch to conversion across all marketing channels.' },
  { name: 'Support Analytics', type: 'Support',    tables: 2, status: 'Draft',  updated: '2026-06-05', description: 'Measures ticket volume, resolution times, CSAT scores, and agent performance.' },
]

const typeColors: Record<string, string> = {
  Financial:  'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  Analytics:  'text-blue-400   bg-blue-400/10   border-blue-400/20',
  Operations: 'text-green-400  bg-green-400/10  border-green-400/20',
  Marketing:  'text-purple-400 bg-purple-400/10 border-purple-400/20',
  Support:    'text-orange-400 bg-orange-400/10 border-orange-400/20',
}

export default function ModelsPage() {
  const [detail, setDetail] = useState<Model | null>(null)

  const stats = [
    { label: 'Total Models', value: mockModels.length,                                    icon: <BrainCircuit className="w-4 h-4" /> },
    { label: 'Active',       value: mockModels.filter(m => m.status === 'Active').length, icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Total Tables', value: mockModels.reduce((acc, m) => acc + m.tables, 0),     icon: <Table2 className="w-4 h-4" /> },
  ]

  return (
    <div>
      <PageHeader
        title="Semantic Models"
        description="Define and manage your business logic and metrics"
        action={
          <AppButton icon={<Plus className="w-4 h-4" />}>
            New Model
          </AppButton>
        }
      />

      <StatsGrid stats={stats} />

      {/* Models list */}
      <div className="space-y-3">
        {mockModels.map((model, i) => (
          <motion.div
            key={model.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => setDetail(model)}
            className="group flex items-center justify-between p-5 rounded-2xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 hover:border-yellow-400/30 hover:bg-yellow-400/[0.03] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-400 dark:text-white/30">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-gray-900 dark:text-white font-semibold group-hover:text-yellow-400 transition-colors">{model.name}</h3>
                <p className="text-gray-400 dark:text-white/30 text-xs mt-0.5">Updated {model.updated}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ColorBadge label={model.type} colorCls={typeColors[model.type]} />
              <span className="text-gray-500 dark:text-white/40 text-sm">{model.tables} tables</span>
              <StatusBadge active={model.status === 'Active'} activeLabel="Active" inactiveLabel="Draft" />
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-yellow-400 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail panel */}
      <SlidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Model Details"
        footer={
          <AppButton fullWidth icon={<BrainCircuit className="w-4 h-4" />}>
            Open Model
          </AppButton>
        }
      >
        {detail && (
          <>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-white/40 flex-shrink-0">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <p className="text-gray-900 dark:text-white text-lg font-bold leading-tight">{detail.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <ColorBadge label={detail.type} colorCls={typeColors[detail.type]} />
                  <StatusBadge active={detail.status === 'Active'} activeLabel="Active" inactiveLabel="Draft" />
                </div>
              </div>
            </div>

            {detail.description && (
              <div className="p-4 rounded-xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/8">
                <p className="text-gray-700 dark:text-white/60 text-sm leading-relaxed">{detail.description}</p>
              </div>
            )}

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <div className="space-y-4">
              <DetailRow icon={<Tag className="w-4 h-4" />}          label="Category"     value={detail.type} />
              <DetailRow icon={<Table2 className="w-4 h-4" />}       label="Tables"       value={`${detail.tables} tables`} />
              <DetailRow icon={<BarChart3 className="w-4 h-4" />}    label="Status"       value={detail.status} />
              <DetailRow icon={<CalendarDays className="w-4 h-4" />} label="Last updated" value={detail.updated} />
            </div>

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-widest mb-3">Included tables</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: detail.tables }).map((_, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 font-mono">
                    table_{i + 1}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </SlidePanel>
    </div>
  )
}
