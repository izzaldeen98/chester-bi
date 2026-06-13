import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDisclosure } from '@heroui/react'
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
  LayoutDashboard, CalendarDays, Plus, FileText, User, Clock,
  ChevronRight, CheckCircle2,
} from '../lib/icons'
import { dashboardsApi } from '../lib/api'
import type { DashboardPublicResponse, DashboardCreate } from '../lib/api'

export default function DashboardsPage() {
  const navigate = useNavigate()
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

      <StatsGrid stats={[
        { label: 'Total',      value: dashboards.length,                                                                            icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'This Month', value: dashboards.filter(d => new Date(d.created_at) > new Date(Date.now() - 30 * 86400000)).length, icon: <CalendarDays className="w-4 h-4" /> },
        { label: 'Active',     value: dashboards.length,                                                                            icon: <CheckCircle2 className="w-4 h-4" /> },
      ]} />

      <ErrorBanner message={error} onDismiss={() => setError('')} className="mb-4" />

      {/* List */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_110px_80px_32px] gap-4 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">
          <span>Dashboard</span><span>Config File</span><span>Created</span>
          <span className="text-center">Status</span><span />
        </div>

        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 dark:bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : dashboards.length === 0 ? (
          <EmptyState
            compact
            icon={<LayoutDashboard className="w-5 h-5" />}
            title="No dashboards yet"
            description="Create your first dashboard to get started"
            action={<AppButton icon={<Plus className="w-4 h-4" />} onClick={onOpen} className="mt-2">Create Dashboard</AppButton>}
          />
        ) : (
          <div>
            {dashboards.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setDetail(d)}
                className="grid grid-cols-[1fr_160px_110px_80px_32px] gap-4 items-center px-5 py-4 border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors group"
              >
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-400 flex-shrink-0">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white text-sm font-medium truncate group-hover:text-yellow-400 transition-colors">
                      {d.name}
                    </p>
                    <p className="text-gray-400 dark:text-white/30 text-xs truncate">{d.description}</p>
                  </div>
                </div>

                {/* Config file */}
                <p className="text-gray-400 dark:text-white/30 text-xs truncate font-mono">{d.config_file || '—'}</p>

                {/* Created */}
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-white/30 text-xs">
                  <CalendarDays className="w-3 h-3 flex-shrink-0" />
                  {new Date(d.created_at).toLocaleDateString()}
                </div>

                {/* Status */}
                <div className="flex items-center justify-center">
                  <StatusBadge active />
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-yellow-400 transition-colors" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <SlidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Dashboard Details"
        footer={
          <AppButton
            fullWidth
            icon={<LayoutDashboard className="w-4 h-4" />}
            onClick={() => { if (detail) { setDetail(null); navigate(`/home/dashboards/${detail.id}`) } }}
          >
            Open Workspace
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
                <p className="text-gray-900 dark:text-white text-lg font-bold leading-tight">{detail.name}</p>
                <StatusBadge active />
              </div>
            </div>

            {detail.description && (
              <div className="p-4 rounded-xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/8">
                <p className="text-gray-700 dark:text-white/60 text-sm leading-relaxed">{detail.description}</p>
              </div>
            )}

            <div className="h-px bg-gray-100 dark:bg-white/5" />

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
