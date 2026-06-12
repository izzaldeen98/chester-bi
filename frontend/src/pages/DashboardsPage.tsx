import { useEffect, useState } from 'react'
import {
  Button,
  Card, CardBody,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Chip,
} from '@heroui/react'
import { AppInput, AppTextarea } from '../components/ui/AppInput'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CalendarDays, CheckCircle2, Plus, AlertCircle,
  X, FileText, User, Clock,
} from 'lucide-react'
import { dashboardsApi } from '../lib/api'
import type { DashboardPublicResponse, DashboardCreate } from '../lib/api'

// ── Detail panel ─────────────────────────────────────────────────────────────

function DashboardDetailPanel({
  dashboard,
  onClose,
}: {
  dashboard: DashboardPublicResponse | null
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {dashboard && (
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
              <p className="text-white font-bold">Dashboard Details</p>
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
                <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 flex-shrink-0">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white text-lg font-bold leading-tight">{dashboard.name}</p>
                  <span className="text-xs px-2.5 py-1 rounded-full border font-medium text-green-400 bg-green-400/10 border-green-400/20">
                    Active
                  </span>
                </div>
              </div>

              {/* Description */}
              {dashboard.description && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
                  <p className="text-white/60 text-sm leading-relaxed">{dashboard.description}</p>
                </div>
              )}

              <div className="h-px bg-white/5" />

              {/* Fields */}
              <div className="space-y-4">
                <DetailRow icon={<CalendarDays className="w-4 h-4" />} label="Created"
                  value={new Date(dashboard.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                <DetailRow icon={<Clock className="w-4 h-4" />} label="Last updated"
                  value={new Date(dashboard.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                <DetailRow icon={<User className="w-4 h-4" />} label="Created by" value={dashboard.created_by} />
                <DetailRow icon={<User className="w-4 h-4" />} label="Last updated by" value={dashboard.updated_by} />
                {dashboard.config_file && (
                  <DetailRow icon={<FileText className="w-4 h-4" />} label="Config file" value={dashboard.config_file} />
                )}
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

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<DashboardPublicResponse[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [error, setError]           = useState('')
  const [detail, setDetail]         = useState<DashboardPublicResponse | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [form, setForm]             = useState<DashboardCreate>({ name: '', description: '' })

  async function loadDashboards() {
    try {
      setLoading(true)
      setDashboards(await dashboardsApi.list())
    } catch { setError('Failed to load dashboards') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadDashboards() }, [])

  async function handleCreate() {
    setCreating(true)
    try {
      await dashboardsApi.create(form)
      onClose(); setForm({ name: '', description: '' }); loadDashboards()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create dashboard')
    } finally { setCreating(false) }
  }

  const statCards = [
    { label: 'Total',      value: dashboards.length,                                                                                       icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'This Month', value: dashboards.filter(d => new Date(d.created_at) > new Date(Date.now() - 30 * 86400000)).length,            icon: <CalendarDays className="w-4 h-4" /> },
    { label: 'Active',     value: dashboards.length,                                                                                       icon: <CheckCircle2 className="w-4 h-4" /> },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Dashboards</h1>
          <p className="text-white/40 text-sm">Manage and explore your analytics dashboards</p>
        </div>
        <Button
          className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
          onPress={onOpen}
          startContent={<Plus className="w-4 h-4" />}
        >
          New Dashboard
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-white/40">{s.icon}<p className="text-xs">{s.label}</p></div>
            <p className="text-white text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : dashboards.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="w-7 h-7 text-white/20" />
          </div>
          <h3 className="text-white/60 text-lg font-semibold mb-2">No dashboards yet</h3>
          <p className="text-white/30 text-sm mb-6">Create your first dashboard to get started</p>
          <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" onPress={onOpen}>
            Create Dashboard
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setDetail(d)}
            >
              <Card className="bg-white/[0.03] border border-white/10 hover:border-yellow-400/30 transition-all cursor-pointer group">
                <CardBody className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <Chip size="sm" className="bg-green-500/10 text-green-400 border-green-500/20">Active</Chip>
                  </div>
                  <h3 className="text-white font-semibold mb-1 group-hover:text-yellow-400 transition-colors">
                    {d.name}
                  </h3>
                  <p className="text-white/40 text-sm line-clamp-2 mb-3">{d.description}</p>
                  <p className="text-white/20 text-xs">{new Date(d.created_at).toLocaleDateString()}</p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      <DashboardDetailPanel dashboard={detail} onClose={() => setDetail(null)} />

      {/* Create Modal */}
      <Modal isOpen={isOpen} onClose={onClose} placement="center" scrollBehavior="inside" backdrop="blur"
        classNames={{ base: 'bg-[#131313] border border-white/10 rounded-2xl', backdrop: 'bg-black/60 backdrop-blur-sm', header: 'text-white border-b border-white/5 font-bold', body: 'py-5', footer: 'border-t border-white/5' }}>
        <ModalContent>
          <ModalHeader>New Dashboard</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <AppInput label="Name" placeholder="My Dashboard" isRequired
                value={form.name} onValueChange={(v) => setForm((p) => ({ ...p, name: v }))} />
              <AppTextarea label="Description" placeholder="Describe what this dashboard shows…" isRequired
                value={form.description} onValueChange={(v) => setForm((p) => ({ ...p, description: v }))} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" className="text-white/50" onPress={onClose}>Cancel</Button>
            <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" isLoading={creating} onPress={handleCreate}>
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
