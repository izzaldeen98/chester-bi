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
  Package, Search, Plus, ChevronRight,
  CalendarDays, ToggleRight, MapPin, User, Pencil,
} from '../lib/icons'
import { packagesApi } from '../lib/api'
import type { PackageResponse } from '../lib/api'

export default function PackagesPage() {
  const navigate = useNavigate()
  const [packages, setPackages]   = useState<PackageResponse[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [detailPkg, setDetailPkg] = useState<PackageResponse | null>(null)

  const createModal = useDisclosure()
  const [creating, setCreating]   = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })

  async function loadPackages() {
    try {
      setLoading(true); setError('')
      setPackages(await packagesApi.list())
    } catch { setError('Failed to load packages') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadPackages() }, [])

  async function handleCreate() {
    if (!createForm.name.trim()) return
    setCreating(true)
    try {
      await packagesApi.create(createForm.name.trim(), createForm.description.trim() || undefined)
      createModal.onClose()
      setCreateForm({ name: '', description: '' })
      loadPackages()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create package')
    } finally { setCreating(false) }
  }

  const filtered = packages.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <PageHeader
        title="Packages"
        description="Manage your semantic model packages"
        action={
          <AppButton icon={<Plus className="w-4 h-4" />} onClick={createModal.onOpen}>
            New Package
          </AppButton>
        }
      />

      <StatsGrid cols={2} stats={[
        { label: 'Total Packages', value: packages.length,                            icon: <Package className="w-4 h-4" /> },
        { label: 'Active',         value: packages.filter((p) => p.is_active).length, icon: <ToggleRight className="w-4 h-4" /> },
      ]} />

      <div className="mb-6">
        <AppInput
          placeholder="Search packages…"
          value={search}
          onValueChange={setSearch}
          startContent={<Search className="w-4 h-4 text-gray-400 dark:text-white/30" />}
        />
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} className="mb-4" />

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_110px_80px_32px] gap-4 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">
          <span>Package</span><span>Location</span><span>Created</span>
          <span className="text-center">Status</span><span />
        </div>

        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 dark:bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState compact icon={<Package className="w-5 h-5" />}
            title={search ? 'No packages match your search' : 'No packages yet — create your first one'} />
        ) : (
          <div>
            {filtered.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setDetailPkg(pkg)}
                className="grid grid-cols-[1fr_180px_110px_80px_32px] gap-4 items-center px-5 py-4 border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-400 flex-shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white text-sm font-medium truncate group-hover:text-yellow-400 transition-colors">
                      {pkg.name}
                    </p>
                    <p className="text-gray-400 dark:text-white/30 text-xs truncate font-mono">{pkg.id}</p>
                  </div>
                </div>

                <p className="text-gray-400 dark:text-white/30 text-xs truncate font-mono">{pkg.location}</p>

                <div className="flex items-center gap-1.5 text-gray-400 dark:text-white/30 text-xs">
                  <CalendarDays className="w-3 h-3 flex-shrink-0" />
                  {new Date(pkg.created_at).toLocaleDateString()}
                </div>

                <div className="flex items-center justify-center">
                  <StatusBadge active={pkg.is_active} />
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-yellow-400 transition-colors" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <SlidePanel
        open={!!detailPkg}
        onClose={() => setDetailPkg(null)}
        title="Package Details"
        footer={
          <AppButton
            fullWidth
            icon={<Pencil className="w-4 h-4" />}
            onClick={() => { if (detailPkg) { setDetailPkg(null); navigate(`/home/packages/${detailPkg.id}`) } }}
          >
            Edit Files
          </AppButton>
        }
      >
        {detailPkg && (
          <>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-400 flex-shrink-0">
                <Package className="w-7 h-7" />
              </div>
              <div>
                <p className="text-gray-900 dark:text-white text-lg font-bold leading-tight">{detailPkg.name}</p>
                <p className="text-gray-500 dark:text-white/40 text-xs font-mono mt-0.5 break-all">{detailPkg.id}</p>
              </div>
            </div>

            <StatusBadge active={detailPkg.is_active} />

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <div className="space-y-4">
              <DetailRow icon={<MapPin className="w-4 h-4" />}     label="Location"     value={detailPkg.location} mono />
              <DetailRow icon={<ToggleRight className="w-4 h-4" />} label="Status"       value={detailPkg.is_active ? 'Active' : 'Inactive'} />
              <DetailRow
                icon={<CalendarDays className="w-4 h-4" />}
                label="Created"
                value={new Date(detailPkg.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              />
              <DetailRow
                icon={<CalendarDays className="w-4 h-4" />}
                label="Last updated"
                value={new Date(detailPkg.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              />
              <DetailRow icon={<User className="w-4 h-4" />} label="Created by" value={detailPkg.created_by} mono />
            </div>
          </>
        )}
      </SlidePanel>

      {/* Create Modal */}
      <AppModal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        title="New Package"
        footer={
          <>
            <AppButton variant="ghost" onClick={createModal.onClose}>Cancel</AppButton>
            <AppButton loading={creating} onClick={handleCreate}>Create Package</AppButton>
          </>
        }
      >
        <div className="space-y-4">
          <AppInput
            label="Package Name"
            isRequired
            placeholder="my-analytics"
            value={createForm.name}
            onValueChange={(v) => setCreateForm((p) => ({ ...p, name: v }))}
          />
          <AppTextarea
            label="Description"
            placeholder="Describe what this package contains…"
            rows={3}
            value={createForm.description}
            onValueChange={(v) => setCreateForm((p) => ({ ...p, description: v }))}
          />
        </div>
      </AppModal>
    </div>
  )
}
