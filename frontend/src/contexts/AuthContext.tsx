import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { login as apiLogin, register as apiRegister } from '../lib/api'
import type { OwnerCreate, CurrentUser } from '../lib/api'

const USER_KEY = 'current_user'

interface AuthContextValue {
  token: string | null
  currentUser: CurrentUser | null
  isAuthenticated: boolean
  hasPermission: (...perms: string[]) => boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: OwnerCreate) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as CurrentUser) : null
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken]           = useState<string | null>(() => localStorage.getItem('access_token'))
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(loadUser)

  // A user can access a resource if they hold any of the listed permissions,
  // OR their permissions list contains "*" (owner / super-admin wildcard).
  function hasPermission(...perms: string[]): boolean {
    if (!currentUser) return false
    const p = currentUser.permissions ?? []
    if (p.includes('*')) return true
    return perms.some((perm) => {
      // exact match OR namespace wildcard  e.g. "dashboards:*" covers "dashboards:list"
      const [ns] = perm.split(':')
      return p.includes(perm) || p.includes(`${ns}:*`)
    })
  }

  async function login(username: string, password: string) {
    const res = await apiLogin(username, password)
    localStorage.setItem('access_token', res.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    setToken(res.access_token)
    setCurrentUser(res.user)
  }

  async function register(data: OwnerCreate) {
    await apiRegister(data)
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setCurrentUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, currentUser, isAuthenticated: !!token, hasPermission, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
