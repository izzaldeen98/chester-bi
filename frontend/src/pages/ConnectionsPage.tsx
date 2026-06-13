import { useEffect, useState } from 'react'
import { useDisclosure } from '@heroui/react'
import { motion } from 'framer-motion'
import {
  Database, Plus, Pencil, Trash2, FlaskConical,
  CheckCircle2, CircleOff, Activity,
  CalendarDays, User, Clock, Tag,
} from '../lib/icons'
import { AppInput } from '../components/ui/AppInput'
import { AppButton } from '../components/ui/AppButton'
import { AppModal } from '../components/ui/AppModal'
import { PageHeader } from '../components/ui/PageHeader'
import { StatsGrid } from '../components/ui/StatCard'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { EmptyState } from '../components/ui/EmptyState'
import { SlidePanel } from '../components/ui/SlidePanel'
import { DetailRow } from '../components/ui/DetailRow'
import { StatusBadge, ColorBadge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { connectionsApi } from '../lib/api'
import type { ConnectionPublicResponse, ConnectionCreate } from '../lib/api'

// ── DB type options ───────────────────────────────────────────────────────────

const DB_TYPES = ['postgres', 'mysql', 'bigquery', 'snowflake', 'duckdb', 'trino']

const typeColor: Record<string, string> = {
  postgresql: 'text-blue-400   bg-blue-400/10   border-blue-400/20',
  mysql:      'text-orange-400 bg-orange-400/10 border-orange-400/20',
  bigquery:   'text-green-400  bg-green-400/10  border-green-400/20',
  snowflake:  'text-cyan-400   bg-cyan-400/10   border-cyan-400/20',
  duckdb:     'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  trino:      'text-purple-400 bg-purple-400/10 border-purple-400/20',
}

const blankForm = (): ConnectionCreate => ({
  name: '', description: '', type: 'postgres',
  connection_attributes: { host: '', port: '5432', database: '', username: '', password: '' },
})

// ── AttrFields ────────────────────────────────────────────────────────────────

function AttrFields({
  attrs, onChange,
}: {
  attrs: ConnectionCreate['connection_attributes']
  onChange: (f: keyof ConnectionCreate['connection_attributes'], v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <AppInput label="Host"     placeholder="localhost"  value={attrs.host}     onValueChange={(v) => onChange('host', v)}     isRequired />
        <AppInput label="Port"     placeholder="5432"       value={attrs.port}     onValueChange={(v) => onChange('port', v)}     isRequired />
      </div>
      <AppInput label="Database" placeholder="my_database" value={attrs.database} onValueChange={(v) => onChange('database', v)} isRequired />
      <div className="grid grid-cols-2 gap-4">
        <AppInput label="Username" placeholder="db_user"    value={attrs.username} onValueChange={(v) => onChange('username', v)} isRequired />
        <AppInput label="Password" password                  value={attrs.password} onValueChange={(v) => onChange('password', v)} isRequired />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionPublicResponse[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [testingId, setTestingId]     = useState<string | null>(null)
  const [testResult, setTestResult]   = useState<Record<string, 'ok' | 'fail'>>({})
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [detail, setDetail]           = useState<ConnectionPublicResponse | null>(null)

  const createModal = useDisclosure()
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState<ConnectionCreate>(blankForm())

  const editModal = useDisclosure()
  const [editTarget, setEditTarget] = useState<ConnectionPublicResponse | null>(null)
  const [editForm, setEditForm]     = useState<ConnectionCreate>(blankForm())
  const [updating, setUpdating]     = useState(false)

  function setAttr(field: keyof ConnectionCreate['connection_attributes'], value: string) {
    setForm((p) => ({ ...p, connection_attributes: { ...p.connection_attributes, [field]: value } }))
  }
  function setEditAttr(field: keyof ConnectionCreate['connection_attributes'], value: string) {
    setEditForm((p) => ({ ...p, connection_attributes: { ...p.connection_attributes, [field]: value } }))
  }

  async function load() {
    try { setLoading(true); setError(''); setConnections(await connectionsApi.list()) }
    catch { setError('Failed to load connections') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    setSaving(true)
    try { await connectionsApi.create(form); createModal.onClose(); setForm(blankForm()); load() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Create failed') }
    finally { setSaving(false) }
  }

  function openEdit(c: ConnectionPublicResponse) {
    setEditTarget(c)
    setEditForm({ name: c.name, description: c.description ?? '', type: c.type, connection_attributes: { host: '', port: '', database: '', username: '', password: '' } })
    editModal.onOpen()
  }

  async function handleUpdate() {
    if (!editTarget) return
    setUpdating(true)
    try {
      await connectionsApi.update(editTarget.id, { name: editForm.name, description: editForm.description, connection_attributes: editForm.connection_attributes })
      editModal.onClose(); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Update failed') }
    finally { setUpdating(false) }
  }

  async function handleTest(id: string) {
    setTestingId(id)
    try { await connectionsApi.test(id); setTestResult((p) => ({ ...p, [id]: 'ok' })) }
    catch { setTestResult((p) => ({ ...p, [id]: 'fail' })) }
    finally { setTestingId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this connection?')) return
    setDeletingId(id)
    try { await connectionsApi.delete(id); load() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setDeletingId(null) }
  }

  return (
    <div>
      <PageHeader
        title="Connections"
        description="Manage your database connections"
        action={
          <AppButton icon={<Plus className="w-4 h-4" />} onClick={createModal.onOpen}>
            New Connection
          </AppButton>
        }
      />

      <StatsGrid stats={[
        { label: 'Total',    value: connections.length,                             icon: <Database className="w-4 h-4" /> },
        { label: 'Active',   value: connections.filter((c) => c.is_active).length,  icon: <CheckCircle2 className="w-4 h-4" /> },
        { label: 'Inactive', value: connections.filter((c) => !c.is_active).length, icon: <CircleOff className="w-4 h-4" /> },
      ]} />

      <ErrorBanner message={error} onDismiss={() => setError('')} className="mb-4" />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : connections.length === 0 ? (
        <EmptyState
          icon={<Database className="w-7 h-7" />}
          title="No connections yet"
          description="Add your first database connection to get started"
          action={<AppButton icon={<Plus className="w-4 h-4" />} onClick={createModal.onOpen}>Add Connection</AppButton>}
        />
      ) : (
        <div className="space-y-3">
          {connections.map((c, i) => {
            const result = testResult[c.id]
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setDetail(c)}
                className="flex items-center justify-between p-5 rounded-2xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-white/40 flex-shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-gray-900 dark:text-white font-semibold text-sm truncate group-hover:text-yellow-400 transition-colors">{c.name}</p>
                      <ColorBadge label={c.type} colorCls={typeColor[c.type] ?? 'text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'} />
                    </div>
                    {c.description && <p className="text-gray-400 dark:text-white/30 text-xs truncate">{c.description}</p>}
                    <p className="text-gray-300 dark:text-white/20 text-xs mt-0.5">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                  {result === 'ok' && (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">
                      <Activity className="w-3 h-3" /> Connected
                    </span>
                  )}
                  {result === 'fail' && (
                    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2.5 py-1 rounded-full">
                      <CircleOff className="w-3 h-3" /> Failed
                    </span>
                  )}
                  <button
                    onClick={() => handleTest(c.id)}
                    disabled={testingId === c.id}
                    title="Test connection"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 dark:text-white/40 hover:text-yellow-400 hover:bg-yellow-400/10 border border-gray-200 dark:border-white/10 hover:border-yellow-400/30 transition-all disabled:opacity-50"
                  >
                    {testingId === c.id
                      ? <Spinner size="xs" className="border-yellow-400/30 border-t-yellow-400" />
                      : <FlaskConical className="w-3.5 h-3.5" />
                    }
                    Test
                  </button>
                  <button onClick={() => openEdit(c)} title="Edit"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 dark:text-white/20 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} title="Delete"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 dark:text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50">
                    {deletingId === c.id
                      ? <Spinner size="xs" className="border-red-400/30 border-t-red-400" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Detail panel */}
      <SlidePanel
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Connection Details"
        footer={
          detail && (
            <div className="flex gap-2">
              <AppButton
                variant="secondary"
                className="flex-1"
                icon={testingId === detail.id ? <Spinner size="xs" className="border-yellow-400/30 border-t-yellow-400" /> : <FlaskConical className="w-4 h-4" />}
                disabled={testingId === detail.id}
                onClick={() => handleTest(detail.id)}
              >
                Test
              </AppButton>
              <AppButton
                className="flex-1"
                icon={<Pencil className="w-4 h-4" />}
                onClick={() => { setDetail(null); openEdit(detail) }}
              >
                Edit
              </AppButton>
            </div>
          )
        }
      >
        {detail && (
          <>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-white/40 flex-shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-lg font-bold leading-tight truncate">{detail.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <ColorBadge label={detail.type} colorCls={typeColor[detail.type] ?? 'text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'} />
                  <StatusBadge active={detail.is_active} />
                </div>
              </div>
            </div>

            {testResult[detail.id] === 'ok' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-sm">
                <Activity className="w-4 h-4 flex-shrink-0" /> Connection successful
              </div>
            )}
            {testResult[detail.id] === 'fail' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
                <CircleOff className="w-4 h-4 flex-shrink-0" /> Connection failed
              </div>
            )}

            {detail.description && (
              <div className="p-4 rounded-xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/8">
                <p className="text-gray-700 dark:text-white/60 text-sm leading-relaxed">{detail.description}</p>
              </div>
            )}

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <div className="space-y-4">
              <DetailRow icon={<Tag className="w-4 h-4" />}           label="Type"            value={detail.type} />
              <DetailRow icon={<CalendarDays className="w-4 h-4" />}  label="Created"         value={new Date(detail.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              <DetailRow icon={<Clock className="w-4 h-4" />}         label="Last updated"    value={new Date(detail.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              <DetailRow icon={<User className="w-4 h-4" />}          label="Created by"      value={detail.created_by} />
              <DetailRow icon={<User className="w-4 h-4" />}          label="Last updated by" value={detail.updated_by} />
            </div>
          </>
        )}
      </SlidePanel>

      {/* Create Modal */}
      <AppModal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        title="New Connection"
        footer={
          <>
            <AppButton variant="ghost" onClick={createModal.onClose}>Cancel</AppButton>
            <AppButton loading={saving} onClick={handleCreate}>Create</AppButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <AppInput label="Name" placeholder="Production DB" isRequired
              value={form.name} onValueChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-white/50 uppercase tracking-widest">
                Type <span className="text-yellow-400">*</span>
              </label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 outline-none transition-all hover:border-gray-300 dark:hover:border-white/25 focus:border-yellow-400 focus:shadow-[0_0_0_3px_rgba(250,204,21,0.12)]">
                {DB_TYPES.map((t) => <option key={t} value={t} className="bg-white dark:bg-[#131313]">{t}</option>)}
              </select>
            </div>
          </div>
          <AppInput label="Description" placeholder="Optional description"
            value={form.description ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, description: v }))} />
          <div className="h-px bg-gray-100 dark:bg-white/5" />
          <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest">Connection Details</p>
          <AttrFields attrs={form.connection_attributes} onChange={setAttr} />
        </div>
      </AppModal>

      {/* Edit Modal */}
      <AppModal
        isOpen={editModal.isOpen}
        onClose={editModal.onClose}
        title={`Edit — ${editTarget?.name}`}
        footer={
          <>
            <AppButton variant="ghost" onClick={editModal.onClose}>Cancel</AppButton>
            <AppButton loading={updating} onClick={handleUpdate}>Save Changes</AppButton>
          </>
        }
      >
        <div className="space-y-4">
          <AppInput label="Name" isRequired value={editForm.name} onValueChange={(v) => setEditForm((p) => ({ ...p, name: v }))} />
          <AppInput label="Description" value={editForm.description ?? ''} onValueChange={(v) => setEditForm((p) => ({ ...p, description: v }))} />
          <div className="h-px bg-gray-100 dark:bg-white/5" />
          <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest">
            Update Connection Details
            <span className="text-gray-400 dark:text-white/25 font-normal normal-case ml-2">(leave blank to keep existing)</span>
          </p>
          <AttrFields attrs={editForm.connection_attributes} onChange={setEditAttr} />
        </div>
      </AppModal>
    </div>
  )
}
