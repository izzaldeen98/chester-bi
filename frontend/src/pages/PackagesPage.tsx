import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure,
} from '@heroui/react'
import { AppInput, AppTextarea } from '../components/ui/AppInput'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Search, Plus, AlertCircle, ChevronRight,
  CalendarDays, ToggleRight, CheckCircle2, CircleOff,
  X, MapPin, User, Pencil,
} from 'lucide-react'
import { packagesApi } from '../lib/api'
import type { PackageResponse } from '../lib/api'

const modalClasses = {
  base: 'bg-white dark:bg-[#131313] border border-gray-200 dark:border-white/10 rounded-2xl',
  backdrop: 'bg-black/60 backdrop-blur-sm',
  header: 'text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/5 font-bold',
  body: 'py-5',
  footer: 'border-t border-gray-100 dark:border-white/5',
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function PackageDetailPanel({
  pkg,
  onClose,
}: {
  pkg: PackageResponse | null
  onClose: () => void
}) {
  const navigate = useNavigate()

  return (
    <AnimatePresence>
      {pkg && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-sm bg-white dark:bg-[#111111] border-l border-gray-200 dark:border-white/10 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/5">
              <p className="text-gray-900 dark:text-white font-bold">Package Details</p>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Icon + name */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-500 dark:text-yellow-400 flex-shrink-0">
                  <Package className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white text-lg font-bold leading-tight">{pkg.name}</p>
                  <p className="text-gray-400 dark:text-white/40 text-xs font-mono mt-0.5 break-all">{pkg.id}</p>
                </div>
              </div>

              {/* Status badge */}
              <div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 w-fit ${
                  pkg.is_active
                    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 border-green-200 dark:border-green-400/20'
                    : 'text-gray-400 dark:text-white/30 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
                }`}>
                  {pkg.is_active
                    ? <><CheckCircle2 className="w-3 h-3" />Active</>
                    : <><CircleOff className="w-3 h-3" />Inactive</>
                  }
                </span>
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              {/* Detail rows */}
              <div className="space-y-4">
                <DetailRow icon={<MapPin className="w-4 h-4" />} label="Location" value={pkg.location} mono />
                <DetailRow icon={<ToggleRight className="w-4 h-4" />} label="Status" value={pkg.is_active ? 'Active' : 'Inactive'} />
                <DetailRow
                  icon={<CalendarDays className="w-4 h-4" />}
                  label="Created"
                  value={new Date(pkg.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                />
                <DetailRow
                  icon={<CalendarDays className="w-4 h-4" />}
                  label="Last updated"
                  value={new Date(pkg.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                />
                <DetailRow icon={<User className="w-4 h-4" />} label="Created by" value={pkg.created_by} mono />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5">
              <Button
                className="w-full bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
                startContent={<Pencil className="w-4 h-4" />}
                onPress={() => { onClose(); navigate(`/home/packages/${pkg.id}`) }}
              >
                Edit Files
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function DetailRow({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 dark:text-white/25 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-gray-400 dark:text-white/40 text-xs mb-0.5">{label}</p>
        <p className={`text-gray-900 dark:text-white text-sm break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageResponse[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [detailPkg, setDetailPkg] = useState<PackageResponse | null>(null)

  const createModal = useDisclosure()
  const [creating, setCreating] = useState(false)
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">Packages</h1>
          <p className="text-gray-500 dark:text-white/40 text-sm">Manage your semantic model packages</p>
        </div>
        <Button
          className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
          onPress={createModal.onOpen}
          startContent={<Plus className="w-4 h-4" />}
        >
          New Package
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Total Packages', value: packages.length,                             icon: <Package className="w-4 h-4" /> },
          { label: 'Active',         value: packages.filter((p) => p.is_active).length,  icon: <ToggleRight className="w-4 h-4" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-gray-400 dark:text-white/40">{s.icon}<p className="text-xs">{s.label}</p></div>
            <p className="text-gray-900 dark:text-white text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <AppInput
          placeholder="Search packages…"
          value={search}
          onValueChange={setSearch}
          startContent={<Search className="w-4 h-4 text-gray-400 dark:text-white/30" />}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_110px_80px_32px] gap-4 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">
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
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center mx-auto mb-3">
              <Package className="w-5 h-5 text-gray-300 dark:text-white/20" />
            </div>
            <p className="text-gray-400 dark:text-white/40">
              {search ? 'No packages match your search' : 'No packages yet — create your first one'}
            </p>
          </div>
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
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-500 dark:text-yellow-400 flex-shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white text-sm font-medium truncate group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors">
                      {pkg.name}
                    </p>
                    <p className="text-gray-400 dark:text-white/30 text-xs truncate font-mono">{pkg.id}</p>
                  </div>
                </div>

                {/* Location */}
                <p className="text-gray-400 dark:text-white/30 text-xs truncate font-mono">{pkg.location}</p>

                {/* Created */}
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-white/30 text-xs">
                  <CalendarDays className="w-3 h-3 flex-shrink-0" />
                  {new Date(pkg.created_at).toLocaleDateString()}
                </div>

                {/* Status */}
                <div className="flex items-center justify-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 ${
                    pkg.is_active
                      ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 border-green-200 dark:border-green-400/20'
                      : 'text-gray-400 dark:text-white/30 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
                  }`}>
                    {pkg.is_active
                      ? <><CheckCircle2 className="w-3 h-3" />Active</>
                      : <><CircleOff className="w-3 h-3" />Inactive</>
                    }
                  </span>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      <PackageDetailPanel pkg={detailPkg} onClose={() => setDetailPkg(null)} />

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        placement="center"
        scrollBehavior="inside"
        backdrop="blur"
        classNames={modalClasses}
      >
        <ModalContent>
          <ModalHeader>New Package</ModalHeader>
          <ModalBody>
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
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" className="text-gray-500 dark:text-white/50" onPress={createModal.onClose}>
              Cancel
            </Button>
            <Button
              className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
              isLoading={creating}
              onPress={handleCreate}
            >
              Create Package
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
