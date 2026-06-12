import { useEffect, useState } from 'react'
import {
  Button,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure,
} from '@heroui/react'
import { AppInput, AppTextarea } from '../components/ui/AppInput'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, CheckCircle2, ShieldCheck, UserRound,
  Search, Plus, AlertCircle, Pencil, X,
  CalendarDays, Mail, Tag, Shield, CircleOff, KeyRound,
} from 'lucide-react'
import { usersApi } from '../lib/api'
import type { UserPublicResponse, UserUpdate } from '../lib/api'

// ── Permissions ─────────────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  'dashboards:list', 'dashboards:view', 'dashboards:edit', 'dashboards:create', 'dashboards:delete', 'dashboards:*',
  'users:list', 'users:edit', 'users:create', 'users:*',
  'connections:list', 'connections:create', 'connections:edit', 'connections:delete', 'connections:*',
  'models:list', 'models:view', 'models:edit', 'models:create', 'models:delete', 'models:*',
  'packages:list', 'packages:edit', 'packages:create', 'packages:delete', 'packages:*',
]

function parsePermissions(raw: string): string[] {
  return raw.split(';').map((s) => s.trim()).filter(Boolean)
}

// ── Shared style tokens ──────────────────────────────────────────────────────
const modalClasses = {
  base: 'bg-[#131313] border border-white/10 rounded-2xl',
  backdrop: 'bg-black/60 backdrop-blur-sm',
  header: 'text-white border-b border-white/5 font-bold',
  body: 'py-5',
  footer: 'border-t border-white/5',
}

const roleBadge = (role: string) => {
  if (role === 'owner') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  if (role === 'admin')  return 'text-blue-400   bg-blue-400/10   border-blue-400/20'
  return 'text-white/40 bg-white/5 border-white/10'
}

// ── User detail panel (slide-in from right) ──────────────────────────────────
function UserDetailPanel({
  user,
  onClose,
  onEdit,
}: {
  user: UserPublicResponse | null
  onClose: () => void
  onEdit: (u: UserPublicResponse) => void
}) {
  return (
    <AnimatePresence>
      {user && (
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
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-sm bg-[#111111] border-l border-white/10 flex flex-col overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <p className="text-white font-bold">User Details</p>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-400 text-xl font-black flex-shrink-0">
                  {user.first_name.charAt(0).toUpperCase()}{user.last_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-lg font-bold leading-tight">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-white/40 text-sm">@{user.username}</p>
                </div>
              </div>

              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${roleBadge(user.role)}`}>
                  {user.role}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 ${
                  user.is_active
                    ? 'text-green-400 bg-green-400/10 border-green-400/20'
                    : 'text-white/30 bg-white/5 border-white/10'
                }`}>
                  {user.is_active
                    ? <><CheckCircle2 className="w-3 h-3" /> Active</>
                    : <><CircleOff className="w-3 h-3" /> Inactive</>
                  }
                </span>
              </div>

              <div className="h-px bg-white/5" />

              {/* Detail fields */}
              <div className="space-y-4">
                {user.email && (
                  <DetailRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
                )}
                <DetailRow
                  icon={<Shield className="w-4 h-4" />}
                  label="Role"
                  value={user.role}
                />
                <DetailRow
                  icon={<CalendarDays className="w-4 h-4" />}
                  label="Joined"
                  value={new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                />
                <DetailRow
                  icon={<CalendarDays className="w-4 h-4" />}
                  label="Last updated"
                  value={new Date(user.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                />
              </div>

              <div className="h-px bg-white/5" />

              {/* Permissions */}
              <div>
                <div className="flex items-center gap-2 mb-3 text-white/40">
                  <Tag className="w-4 h-4" />
                  <p className="text-xs font-semibold uppercase tracking-widest">Permissions</p>
                </div>
                {user.permissions && user.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 font-mono"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/25 text-sm italic">No permissions assigned</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5">
              <Button
                className="w-full bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
                startContent={<Pencil className="w-4 h-4" />}
                onPress={() => { onClose(); onEdit(user) }}
              >
                Edit User
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

// ── Main component ───────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers]     = useState<UserPublicResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  // Detail panel
  const [detailUser, setDetailUser] = useState<UserPublicResponse | null>(null)

  // Create modal
  const createModal = useDisclosure()
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<{ username: string; first_name: string; last_name: string; password: string; permissionsRaw: string }>({
    username: '', first_name: '', last_name: '', password: '', permissionsRaw: '',
  })

  // Edit modal
  const editModal = useDisclosure()
  const [editTarget, setEditTarget] = useState<UserPublicResponse | null>(null)
  const [updating, setUpdating] = useState(false)
  const [removingPassword, setRemovingPassword] = useState(false)
  const [editForm, setEditForm] = useState<UserUpdate & { permissionsRaw: string }>({
    first_name: '', last_name: '', username: '', email: '', role: '', permissionsRaw: '', is_active: true,
  })

  async function loadUsers() {
    try {
      setLoading(true); setError('')
      setUsers(await usersApi.list())
    } catch { setError('Failed to load users') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [])

  // ── Create ─────────────────────────────────────────────────────────────
  async function handleCreate() {
    setCreating(true)
    try {
      const { permissionsRaw, password, ...rest } = createForm
      await usersApi.create({
        ...rest,
        ...(password ? { password } : {}),
        permissions: permissionsRaw ? parsePermissions(permissionsRaw) : undefined,
      })
      createModal.onClose()
      setCreateForm({ username: '', first_name: '', last_name: '', password: '', permissionsRaw: '' })
      loadUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally { setCreating(false) }
  }

  // ── Edit ───────────────────────────────────────────────────────────────
  function openEdit(user: UserPublicResponse) {
    setEditTarget(user)
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email ?? '',
      role: user.role,
      is_active: user.is_active,
      permissionsRaw: (user.permissions ?? []).join('; '),
    })
    editModal.onOpen()
  }

  async function handleRemovePassword() {
    if (!editTarget) return
    if (!confirm(`Remove password for @${editTarget.username}? They will need to set a new one via the Set Password page.`)) return
    setRemovingPassword(true)
    try {
      await usersApi.update(editTarget.id, { is_password_set: false })
      editModal.onClose()
      loadUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove password')
    } finally { setRemovingPassword(false) }
  }

  async function handleUpdate() {
    if (!editTarget) return
    setUpdating(true)
    try {
      const { permissionsRaw, ...rest } = editForm
      const payload: typeof rest & { permissions?: string[] } = {}
      if (rest.first_name && rest.first_name !== editTarget.first_name) payload.first_name = rest.first_name
      if (rest.last_name  && rest.last_name  !== editTarget.last_name)  payload.last_name  = rest.last_name
      if (rest.username   && rest.username   !== editTarget.username)   payload.username   = rest.username
      if (rest.email      && rest.email      !== (editTarget.email ?? '')) payload.email   = rest.email
      if (rest.role       && rest.role       !== editTarget.role)       payload.role       = rest.role
      if (rest.is_active !== undefined && rest.is_active !== editTarget.is_active) payload.is_active = rest.is_active
      if (permissionsRaw !== undefined) payload.permissions = permissionsRaw ? parsePermissions(permissionsRaw) : []
      await usersApi.update(editTarget.id, payload)
      editModal.onClose()
      loadUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally { setUpdating(false) }
  }

  const filtered = users.filter((u) =>
    [u.username, u.first_name, u.last_name].some((f) => f.toLowerCase().includes(search.toLowerCase())),
  )

  const permHint = (
    <p className="text-[11px] text-white/25 mt-1 leading-relaxed">
      Separate with <span className="text-yellow-400/60">;</span> — Available:&nbsp;
      <span className="text-white/35">{ALL_PERMISSIONS.join(' ; ')}</span>
    </p>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Users</h1>
          <p className="text-white/40 text-sm">Manage your organization members and permissions</p>
        </div>
        <Button
          className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
          onPress={createModal.onOpen}
          startContent={<Plus className="w-4 h-4" />}
        >
          Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Users', value: users.length,                                                                icon: <Users className="w-4 h-4" /> },
          { label: 'Active',      value: users.filter((u) => u.is_active).length,                                    icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'Admins',      value: users.filter((u) => u.role === 'admin' || u.role === 'owner').length,       icon: <ShieldCheck className="w-4 h-4" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1 text-white/40">{s.icon}<p className="text-xs">{s.label}</p></div>
            <p className="text-white text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <AppInput placeholder="Search users…" value={search} onValueChange={setSearch}
          startContent={<Search className="w-4 h-4 text-white/30" />}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_110px_80px_40px] gap-4 px-5 py-3 bg-white/[0.02] border-b border-white/5 text-xs font-semibold text-white/30 uppercase tracking-wider">
          <span>User</span><span>Role</span><span>Joined</span>
          <span className="text-center">Status</span><span />
        </div>

        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
              <UserRound className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-white/40">No users found</p>
          </div>
        ) : (
          <div>
            {filtered.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setDetailUser(user)}
                className="grid grid-cols-[1fr_120px_110px_80px_40px] gap-4 items-center px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.03] cursor-pointer transition-colors group"
              >
                {/* User */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-400 text-sm font-bold flex-shrink-0">
                    {user.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate group-hover:text-yellow-400 transition-colors">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-white/30 text-xs truncate">@{user.username}</p>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${roleBadge(user.role)}`}>
                    {user.role}
                  </span>
                </div>

                {/* Joined */}
                <p className="text-white/30 text-xs">{new Date(user.created_at).toLocaleDateString()}</p>

                {/* Status */}
                <div className="flex items-center justify-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                    user.is_active
                      ? 'text-green-400 bg-green-400/10 border-green-400/20'
                      : 'text-white/30 bg-white/5 border-white/10'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Edit — stop propagation so row click doesn't also open detail */}
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(user) }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-white/20 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail panel ─────────────────────────────────────────────────── */}
      <UserDetailPanel
        user={detailUser}
        onClose={() => setDetailUser(null)}
        onEdit={openEdit}
      />

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} placement="center" scrollBehavior="inside" backdrop="blur" classNames={modalClasses}>
        <ModalContent>
          <ModalHeader>Invite User</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <AppInput label="First Name" isRequired value={createForm.first_name}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, first_name: v }))} />
                <AppInput label="Last Name" isRequired value={createForm.last_name}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, last_name: v }))} />
              </div>
              <AppInput label="Username" isRequired value={createForm.username}
                onValueChange={(v) => setCreateForm((p) => ({ ...p, username: v }))} />
              <div>
                <AppTextarea label="Permissions" placeholder="dashboards:list; users:list; models:view" rows={2}
                  value={createForm.permissionsRaw}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, permissionsRaw: v }))} />
                {permHint}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" className="text-white/50" onPress={createModal.onClose}>Cancel</Button>
            <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" isLoading={creating} onPress={handleCreate}>
              Create User
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} placement="center" scrollBehavior="inside" backdrop="blur" classNames={modalClasses}>
        <ModalContent>
          <ModalHeader>Edit User — @{editTarget?.username}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <AppInput label="First Name" value={editForm.first_name ?? ''}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, first_name: v }))} />
                <AppInput label="Last Name" value={editForm.last_name ?? ''}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, last_name: v }))} />
              </div>
              <AppInput label="Username" value={editForm.username ?? ''}
                onValueChange={(v) => setEditForm((p) => ({ ...p, username: v }))} />
              <AppInput label="Email" type="email" value={editForm.email ?? ''}
                onValueChange={(v) => setEditForm((p) => ({ ...p, email: v }))} />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Role</label>
                  <select value={editForm.role ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white bg-white/[0.05] border border-white/10 outline-none transition-all hover:border-white/25 focus:border-yellow-400 focus:shadow-[0_0_0_3px_rgba(250,204,21,0.12)]">
                    <option value="user"  className="bg-[#131313]">user</option>
                    <option value="admin" className="bg-[#131313]">admin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Status</label>
                  <select value={editForm.is_active ? 'active' : 'inactive'} onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.value === 'active' }))}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white bg-white/[0.05] border border-white/10 outline-none transition-all hover:border-white/25 focus:border-yellow-400 focus:shadow-[0_0_0_3px_rgba(250,204,21,0.12)]">
                    <option value="active"   className="bg-[#131313]">Active</option>
                    <option value="inactive" className="bg-[#131313]">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <AppTextarea label="Permissions" placeholder="dashboards:list; users:list; models:view" rows={2}
                  value={editForm.permissionsRaw ?? ''}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, permissionsRaw: v }))} />
                {permHint}
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex-col gap-3">
            <div className="flex gap-2 w-full">
              <Button variant="ghost" className="text-white/50" onPress={editModal.onClose}>Cancel</Button>
              <Button className="flex-1 bg-yellow-400 text-black font-semibold hover:bg-yellow-300" isLoading={updating} onPress={handleUpdate}>
                Save Changes
              </Button>
            </div>
            <Button
              variant="flat"
              className="w-full bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
              startContent={<KeyRound className="w-4 h-4" />}
              isLoading={removingPassword}
              onPress={handleRemovePassword}
            >
              Remove Password
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
