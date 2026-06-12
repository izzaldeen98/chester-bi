import { useEffect, useState } from 'react'
import { Card, CardBody, Chip, useDisclosure } from '@heroui/react'
import { AppInput, AppTextarea } from '../components/ui/AppInput'
import { AppButton } from '../components/ui/AppButton'
import { AppModal } from '../components/ui/AppModal'
import { PageHeader } from '../components/ui/PageHeader'
import { StatsGrid } from '../components/ui/StatCard'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { EmptyState } from '../components/ui/EmptyState'
import { SlidePanel } from '../components/ui/SlidePanel'
import { DetailRow } from '../components/ui/DetailRow'
import { StatusBadge } from '../components/ui/Badge'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, CalendarDays, CheckCircle2, Plus,
  FileText, User, Clock,
} from 'lucide-react'
import { dashboardsApi } from '../lib/api'
import type { DashboardPublicResponse, DashboardCreate } from '../lib/api'

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
    { label: 'Total',      value: dashboards.length,                                                                            icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'This Month', value: dashboards.filter(d => new Date(d.created_at) > new Date(Date.now() - 30 * 86400000)).length, icon: <CalendarDays className="w-4 h-4" /> },
    { label: 'Active',     value: dashboards.length,                                                                            icon: <CheckCircle2 className="w-4 h-4" /> },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboards"
        description="Manage and explore your analytics dashboards"
        action={
          <AppButton icon={<Plus className="w-4 h-4" />} onClick={onOpen}>
            New Dashboard
          </AppButton>
        }
      />

      <StatsGrid stats={statCards} />

      <ErrorBanner message={error} onDismiss={() => setError('')} className="mb-4" />

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : dashboards.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard className="w-7 h-7" />}
          title="No dashboards yet"
          description="Create your first dashboard to get started"
          action={<AppButton icon={<Plus className="w-4 h-4" />} onClick={onOpen}>Create Dashboard</AppButton>}
        />
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
      <SlidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Dashboard Details"
        footer={
          <AppButton fullWidth icon={<LayoutDashboard className="w-4 h-4" />} onClick={() => setDetail(null)}>
            Open Dashboard
          </AppButton>
        }
      >
        {detail && (
          <>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 flex-shrink-0">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white text-lg font-bold leading-tight">{detail.name}</p>
                <StatusBadge active />
              </div>
            </div>

            {detail.description && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
                <p className="text-white/60 text-sm leading-relaxed">{detail.description}</p>
              </div>
            )}

            <div className="h-px bg-white/5" />

            <div className="space-y-4">
              <DetailRow icon={<CalendarDays className="w-4 h-4" />} label="Created"
                value={new Date(detail.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              <DetailRow icon={<Clock className="w-4 h-4" />} label="Last updated"
                value={new Date(detail.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              <DetailRow icon={<User className="w-4 h-4" />} label="Created by" value={detail.created_by} />
              <DetailRow icon={<User className="w-4 h-4" />} label="Last updated by" value={detail.updated_by} />
              {detail.config_file && (
                <DetailRow icon={<FileText className="w-4 h-4" />} label="Config file" value={detail.config_file} />
              )}
            </div>
          </>
        )}
      </SlidePanel>

      {/* Create Modal */}
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        title="New Dashboard"
        footer={
          <>
            <AppButton variant="ghost" onClick={onClose}>Cancel</AppButton>
            <AppButton loading={creating} onClick={handleCreate}>Create</AppButton>
          </>
        }
      >
        <div className="space-y-4">
          <AppInput label="Name" placeholder="My Dashboard" isRequired
            value={form.name} onValueChange={(v) => setForm((p) => ({ ...p, name: v }))} />
          <AppTextarea label="Description" placeholder="Describe what this dashboard shows…" isRequired
            value={form.description} onValueChange={(v) => setForm((p) => ({ ...p, description: v }))} />
        </div>
      </AppModal>
    </div>
  )
}
