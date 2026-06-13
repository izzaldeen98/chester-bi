import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Package, Users, LogOut, X, Database, Sun, Moon, Table2 } from '../lib/icons'
import { GiJesterHat } from 'react-icons/gi'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

interface NavItem {
  label: string
  icon: React.ReactNode
  path: string
  permissions: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboards',  icon: <LayoutDashboard className="w-4 h-4" />, path: '/home/dashboards', permissions: ['dashboards:list', 'dashboards:*'] },
  { label: 'Query',       icon: <Table2 className="w-4 h-4" />,          path: '/home/query',      permissions: ['packages:list', 'packages:*'] },
  { label: 'Packages',    icon: <Package className="w-4 h-4" />,         path: '/home/packages',   permissions: ['packages:list', 'packages:*'] },
  { label: 'Connections', icon: <Database className="w-4 h-4" />,        path: '/home/connections', permissions: ['connections:list', 'connections:*'] },
  { label: 'Users',       icon: <Users className="w-4 h-4" />,           path: '/home/users',       permissions: ['users:list', 'users:*'] },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function SidebarContent({ onClose, mobile = false }: { onClose: () => void; mobile?: boolean }) {
  const { logout, hasPermission } = useAuth()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-1">
          <GiJesterHat className="text-yellow-500 dark:text-yellow-400 text-2xl flex-shrink-0" />
          <span className="text-yellow-500 dark:text-yellow-400 text-xl font-black">chester</span>
          <span className="text-gray-900 dark:text-white text-xl font-black"> BI</span>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const allowed = hasPermission(...item.permissions)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={mobile ? onClose : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-yellow-400/10 text-yellow-500 dark:text-yellow-400 border border-yellow-400/20'
                    : allowed
                      ? 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                      : 'text-gray-300 dark:text-white/20 cursor-default pointer-events-none'
                }`
              }
            >
              {item.icon}
              {item.label}
              {!allowed && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/20 font-normal">
                  No access
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-2">
        {/* Theme toggle */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-white/40">
            {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{isDark ? 'Dark mode' : 'Light mode'}</span>
          </div>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none ${
              isDark ? 'bg-yellow-400' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
                isDark ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* ── Desktop: always visible static sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-white/5 sticky top-0 flex-shrink-0">
        <SidebarContent onClose={onClose} />
      </aside>

      {/* ── Mobile: animated drawer + overlay ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
              onClick={onClose}
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-[#111111] border-r border-gray-200 dark:border-white/5 lg:hidden"
            >
              <SidebarContent onClose={onClose} mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
