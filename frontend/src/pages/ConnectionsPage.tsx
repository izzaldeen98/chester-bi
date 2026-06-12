import { useEffect, useState } from 'react'
import {
  Button,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure,
} from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database, Plus, Pencil, Trash2, FlaskConical,
  AlertCircle, CheckCircle2, CircleOff, Activity,
  X, CalendarDays, User, Clock, Tag,
} from 'lucide-react'
import { AppInput } from '../components/ui/AppInput'
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

const modalClasses = {
  base:     'bg-[#131313] border border-white/10 rounded-2xl',
  backdrop: 'bg-black/60 backdrop-blur-sm',
  header:   'text-white border-b border-white/5 font-bold',
  body:     'py-5',
  footer:   'border-t border-white/5',
}

const blankForm = (): ConnectionCreate => ({
  name: '', description: '', type: 'postgresql',
  connection_attributes: { host: '', port: '5432', database: '', username: '', password: '' },
})

// ── AttrFields — defined outside component for stable identity ────────────────

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

// ── Detail panel ──────────────────────────────────────────────────────────────

function ConnectionDetailPanel({
  conn,
  onClose,
  onEdit,
  onTest,
  testResult,
  testingId,
}: {
  conn: ConnectionPublicResponse | null
  onClose: () => void
  onEdit: (c: ConnectionPublicResponse) => void
  onTest: (id: string) => void
  testResult: Record<string, 'ok' | 'fail'>
  testingId: string | null
}) {
  return (
    <AnimatePresence>
      {conn && (
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
              <p className="text-white font-bold">Connection Details</p>
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
                  <Database className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-lg font-bold leading-tight truncate">{conn.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${typeColor[conn.type] ?? 'text-white/40 bg-white/5 border-white/10'}`}>
                      {conn.type}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${
                      conn.is_active
                        ? 'text-green-400 bg-green-400/10 border-green-400/20'
                        : 'text-white/30 bg-white/5 border-white/10'
                    }`}>
                      {conn.is_active ? <><CheckCircle2 className="w-3 h-3" /> Active</> : <><CircleOff className="w-3 h-3" /> Inactive</>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Test result */}
              {testResult[conn.id] === 'ok' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-sm">
                  <Activity className="w-4 h-4 flex-shrink-0" />
                  Connection successful
                </div>
              )}
              {testResult[conn.id] === 'fail' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
                  <CircleOff className="w-4 h-4 flex-shrink-0" />
                  Connection failed
                </div>
              )}

              {/* Description */}
              {conn.description && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
                  <p className="text-white/60 text-sm leading-relaxed">{conn.description}</p>
                </div>
              )}

              <div className="h-px bg-white/5" />

              {/* Fields */}
              <div className="space-y-4">
                <DetailRow icon={<Tag className="w-4 h-4" />}           label="Type"           value={conn.type} />
                <DetailRow icon={<CalendarDays className="w-4 h-4" />}  label="Created"        value={new Date(conn.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                <DetailRow icon={<Clock className="w-4 h-4" />}         label="Last updated"   value={new Date(conn.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                <DetailRow icon={<User className="w-4 h-4" />}          label="Created by"     value={conn.created_by} />
                <DetailRow icon={<User className="w-4 h-4" />}          label="Last updated by" value={conn.updated_by} />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex gap-2">
              <Button
                variant="flat"
                className="flex-1 bg-white/5 text-white/60 hover:bg-white/10"
                startContent={testingId === conn.id
                  ? <span className="w-4 h-4 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
                  : <FlaskConical className="w-4 h-4" />
                }
                isDisabled={testingId === conn.id}
                onPress={() => onTest(conn.id)}
              >
                Test
              </Button>
              <Button
                className="flex-1 bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
                startContent={<Pencil className="w-4 h-4" />}
                onPress={() => { onClose(); onEdit(conn) }}
              >
                Edit
              </Button>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Connections</h1>
          <p className="text-white/40 text-sm">Manage your database connections</p>
        </div>
        <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" onPress={createModal.onOpen} startContent={<Plus className="w-4 h-4" />}>
          New Connection
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total',    value: connections.length,                            icon: <Database className="w-4 h-4" /> },
          { label: 'Active',   value: connections.filter((c) => c.is_active).length, icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Inactive', value: connections.filter((c) => !c.is_active).length,icon: <CircleOff className="w-4 h-4" /> },
        ].map((s) => (
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

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Database className="w-7 h-7 text-white/20" />
          </div>
          <h3 className="text-white/60 text-lg font-semibold mb-2">No connections yet</h3>
          <p className="text-white/30 text-sm mb-6">Add your first database connection to get started</p>
          <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" onPress={createModal.onOpen}>Add Connection</Button>
        </div>
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
                className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.05] transition-all group cursor-pointer"
              >
                {/* Left */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 flex-shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-semibold text-sm truncate group-hover:text-yellow-400 transition-colors">{c.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${typeColor[c.type] ?? 'text-white/40 bg-white/5 border-white/10'}`}>
                        {c.type}
                      </span>
                    </div>
                    {c.description && <p className="text-white/30 text-xs truncate">{c.description}</p>}
                    <p className="text-white/20 text-xs mt-0.5">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Right — stop propagation on action buttons */}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-yellow-400 hover:bg-yellow-400/10 border border-white/10 hover:border-yellow-400/30 transition-all disabled:opacity-50"
                  >
                    {testingId === c.id
                      ? <span className="w-3 h-3 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
                      : <FlaskConical className="w-3.5 h-3.5" />
                    }
                    Test
                  </button>
                  <button onClick={() => openEdit(c)} title="Edit"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} title="Delete"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50">
                    {deletingId === c.id
                      ? <span className="w-3 h-3 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
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
      <ConnectionDetailPanel
        conn={detail}
        onClose={() => setDetail(null)}
        onEdit={openEdit}
        onTest={handleTest}
        testResult={testResult}
        testingId={testingId}
      />

      {/* Create Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} placement="center" scrollBehavior="inside" backdrop="blur" classNames={modalClasses}>
        <ModalContent>
          <ModalHeader>New Connection</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <AppInput label="Name" placeholder="Production DB" isRequired
                  value={form.name} onValueChange={(v) => setForm((p) => ({ ...p, name: v }))} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                    Type <span className="text-yellow-400">*</span>
                  </label>
                  <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white bg-white/[0.05] border border-white/10 outline-none transition-all hover:border-white/25 focus:border-yellow-400 focus:shadow-[0_0_0_3px_rgba(250,204,21,0.12)]">
                    {DB_TYPES.map((t) => <option key={t} value={t} className="bg-[#131313]">{t}</option>)}
                  </select>
                </div>
              </div>
              <AppInput label="Description" placeholder="Optional description"
                value={form.description ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, description: v }))} />
              <div className="h-px bg-white/5" />
              <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest">Connection Details</p>
              <AttrFields attrs={form.connection_attributes} onChange={setAttr} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" className="text-white/50" onPress={createModal.onClose}>Cancel</Button>
            <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" isLoading={saving} onPress={handleCreate}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} placement="center" scrollBehavior="inside" backdrop="blur" classNames={modalClasses}>
        <ModalContent>
          <ModalHeader>Edit — {editTarget?.name}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <AppInput label="Name" isRequired value={editForm.name} onValueChange={(v) => setEditForm((p) => ({ ...p, name: v }))} />
              <AppInput label="Description" value={editForm.description ?? ''} onValueChange={(v) => setEditForm((p) => ({ ...p, description: v }))} />
              <div className="h-px bg-white/5" />
              <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest">
                Update Connection Details
                <span className="text-white/25 font-normal normal-case ml-2">(leave blank to keep existing)</span>
              </p>
              <AttrFields attrs={editForm.connection_attributes} onChange={setEditAttr} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" className="text-white/50" onPress={editModal.onClose}>Cancel</Button>
            <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" isLoading={updating} onPress={handleUpdate}>Save Changes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
