import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isAuthenticated, currentUser } = useAuth()

  if (!isAuthenticated) return null

  const initials = currentUser
    ? `${currentUser.first_name.charAt(0)}${currentUser.last_name.charAt(0)}`.toUpperCase()
    : 'U'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d] sticky top-0 z-20">
          <button
            className="lg:hidden text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="w-8 h-8 rounded-full bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center text-yellow-500 dark:text-yellow-400 text-sm font-bold">
            {initials}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
