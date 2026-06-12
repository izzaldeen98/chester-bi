import { useEffect, useState } from 'react'
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
import { StatusBadge, ColorBadge } from '../components/ui/Badge'
import { motion } from 'framer-motion'
import {
  Users, CheckCircle2, ShieldCheck, UserRound,
  Search, Plus, Pencil,
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

const roleBadgeCls = (role: string) => {
  if (role === 'owner') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  if (role === 'admin')  return 'text-blue-400   bg-blue-400/10   border-blue-400/20'
  return 'text-white/40 bg-white/5 border-white/10'
}

// ── Main component ───────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers]     = useState<UserPublicResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  const [detailUser, setDetailUser] = useState<UserPublicResponse | null>(null)

  const createModal = useDisclosure()
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<{ username: string; first_name: string; last_name: string; password: string; permissionsRaw: string }>({
    username: '', first_name: '', last_name: '', password: '', permissionsRaw: '',
  })

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
      <PageHeader
        title="Users"
        description="Manage your organization members and permissions"
        action={
          <AppButton icon={<Plus className="w-4 h-4" />} onClick={createModal.onOpen}>
            Invite User
          </AppButton>
        }
      />

      <StatsGrid stats={[
        { label: 'Total Users', value: users.length,                                                          icon: <Users className="w-4 h-4" /> },
        { label: 'Active',      value: users.filter((u) => u.is_active).length,                               icon: <CheckCircle2 className="w-4 h-4" /> },
        { label: 'Admins',      value: users.filter((u) => u.role === 'admin' || u.role === 'owner').length,  icon: <ShieldCheck className="w-4 h-4" /> },
      ]} />

      <div className="mb-6">
        <AppInput placeholder="Search users…" value={search} onValueChange={setSearch}
          startContent={<Search className="w-4 h-4 text-white/30" />}
        />
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} className="mb-4" />

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
          <EmptyState compact icon={<UserRound className="w-5 h-5" />} title="No users found" />
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

                <div>
                  <ColorBadge label={user.role} colorCls={roleBadgeCls(user.role)} />
                </div>

                <p className="text-white/30 text-xs">{new Date(user.created_at).toLocaleDateString()}</p>

                <div className="flex items-center justify-center">
                  <StatusBadge active={user.is_active} />
                </div>

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

      {/* Detail panel */}
      <SlidePanel
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        title="User Details"
        footer={
          <AppButton
            fullWidth
            icon={<Pencil className="w-4 h-4" />}
            onClick={() => { setDetailUser(null); if (detailUser) openEdit(detailUser) }}
          >
            Edit User
          </AppButton>
        }
      >
        {detailUser && (
          <>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400/15 border border-yellow-400/20 flex items-center justify-center text-yellow-400 text-xl font-black flex-shrink-0">
                {detailUser.first_name.charAt(0).toUpperCase()}{detailUser.last_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-lg font-bold leading-tight">
                  {detailUser.first_name} {detailUser.last_name}
                </p>
                <p className="text-white/40 text-sm">@{detailUser.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ColorBadge label={detailUser.role} colorCls={roleBadgeCls(detailUser.role)} />
              <StatusBadge active={detailUser.is_active} />
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-4">
              {detailUser.email && (
                <DetailRow icon={<Mail className="w-4 h-4" />} label="Email" value={detailUser.email} />
              )}
              <DetailRow icon={<Shield className="w-4 h-4" />} label="Role" value={detailUser.role} />
              <DetailRow icon={<CalendarDays className="w-4 h-4" />} label="Joined"
                value={new Date(detailUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              <DetailRow icon={<CalendarDays className="w-4 h-4" />} label="Last updated"
                value={new Date(detailUser.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
            </div>

            <div className="h-px bg-white/5" />

            <div>
              <div className="flex items-center gap-2 mb-3 text-white/40">
                <Tag className="w-4 h-4" />
                <p className="text-xs font-semibold uppercase tracking-widest">Permissions</p>
              </div>
              {detailUser.permissions && detailUser.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detailUser.permissions.map((p) => (
                    <span key={p} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-white/25 text-sm italic">No permissions assigned</p>
              )}
            </div>
          </>
        )}
      </SlidePanel>

      {/* Create Modal */}
      <AppModal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        title="Invite User"
        footer={
          <>
            <AppButton variant="ghost" onClick={createModal.onClose}>Cancel</AppButton>
            <AppButton loading={creating} onClick={handleCreate}>Create User</AppButton>
          </>
        }
      >
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
      </AppModal>

      {/* Edit Modal */}
      <AppModal
        isOpen={editModal.isOpen}
        onClose={editModal.onClose}
        title={`Edit User — @${editTarget?.username}`}
        footer={
          <div className="flex flex-col gap-3 w-full">
            <div className="flex gap-2 w-full">
              <AppButton variant="ghost" onClick={editModal.onClose}>Cancel</AppButton>
              <AppButton className="flex-1" loading={updating} onClick={handleUpdate}>Save Changes</AppButton>
            </div>
            <AppButton
              variant="danger-ghost"
              fullWidth
              icon={<KeyRound className="w-4 h-4" />}
              loading={removingPassword}
              onClick={handleRemovePassword}
            >
              Remove Password
            </AppButton>
          </div>
        }
      >
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
      </AppModal>
    </div>
  )
}
