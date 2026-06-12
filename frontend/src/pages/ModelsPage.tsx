import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BrainCircuit, CheckCircle2, Table2, Plus, ChevronRight,
  X, CalendarDays, Tag, BarChart3, CircleOff,
} from 'lucide-react'

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

// ── Detail panel ─────────────────────────────────────────────────────────────

function ModelDetailPanel({ model, onClose }: { model: Model | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {model && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-sm bg-[#111111] border-l border-white/10 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <p className="text-white font-bold">Model Details</p>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Icon + name */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 flex-shrink-0">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white text-lg font-bold leading-tight">{model.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${typeColors[model.type] ?? ''}`}>
                      {model.type}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${
                      model.status === 'Active'
                        ? 'text-green-400 bg-green-400/10 border-green-400/20'
                        : 'text-white/30 bg-white/5 border-white/10'
                    }`}>
                      {model.status === 'Active'
                        ? <><CheckCircle2 className="w-3 h-3" /> Active</>
                        : <><CircleOff className="w-3 h-3" /> Draft</>
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {model.description && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
                  <p className="text-white/60 text-sm leading-relaxed">{model.description}</p>
                </div>
              )}

              <div className="h-px bg-white/5" />

              {/* Fields */}
              <div className="space-y-4">
                <DetailRow icon={<Tag className="w-4 h-4" />}          label="Category"      value={model.type} />
                <DetailRow icon={<Table2 className="w-4 h-4" />}       label="Tables"        value={`${model.tables} tables`} />
                <DetailRow icon={<BarChart3 className="w-4 h-4" />}    label="Status"        value={model.status} />
                <DetailRow icon={<CalendarDays className="w-4 h-4" />} label="Last updated"  value={model.updated} />
              </div>

              <div className="h-px bg-white/5" />

              {/* Table chips */}
              <div>
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Included tables</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: model.tables }).map((_, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 font-mono">
                      table_{i + 1}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-white/25 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-white/40 text-xs mb-0.5">{label}</p>
        <p className="text-white text-sm break-all">{value}</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ModelsPage() {
  const [detail, setDetail] = useState<Model | null>(null)

  const stats = [
    { label: 'Total Models', value: mockModels.length,                                     icon: <BrainCircuit className="w-4 h-4" /> },
    { label: 'Active',       value: mockModels.filter(m => m.status === 'Active').length,  icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Total Tables', value: mockModels.reduce((acc, m) => acc + m.tables, 0),      icon: <Table2 className="w-4 h-4" /> },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Semantic Models</h1>
          <p className="text-white/40 text-sm">Define and manage your business logic and metrics</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-colors text-sm">
          <Plus className="w-4 h-4" />
          New Model
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-white/40">{s.icon}<p className="text-xs">{s.label}</p></div>
            <p className="text-white text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Models list */}
      <div className="space-y-3">
        {mockModels.map((model, i) => (
          <motion.div
            key={model.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => setDetail(model)}
            className="group flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-yellow-400/30 hover:bg-yellow-400/[0.03] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-semibold group-hover:text-yellow-400 transition-colors">{model.name}</h3>
                <p className="text-white/30 text-xs mt-0.5">Updated {model.updated}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${typeColors[model.type] ?? ''}`}>
                {model.type}
              </span>
              <span className="text-white/40 text-sm">{model.tables} tables</span>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                model.status === 'Active'
                  ? 'text-green-400 bg-green-400/10 border-green-400/20'
                  : 'text-white/30 bg-white/5 border-white/10'
              }`}>
                {model.status}
              </span>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-yellow-400 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail panel */}
      <ModelDetailPanel model={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
