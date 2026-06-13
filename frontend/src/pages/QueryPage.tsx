import { useNavigate } from 'react-router-dom'
import { QueryWorkspace } from '../components/ui/QueryWorkspace'
import { ArrowLeft } from '../lib/icons'
import { GiJesterHat } from 'react-icons/gi'
import { useTheme } from '../contexts/ThemeContext'
import { Moon, Sun } from '../lib/icons'

export default function QueryPage() {
  const navigate = useNavigate()
  const { isDark, toggle } = useTheme()

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#141414] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0 bg-white dark:bg-[#141414]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/70 transition-colors text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <GiJesterHat className="text-yellow-500 dark:text-yellow-400 text-lg flex-shrink-0" />
            <span className="text-gray-900 dark:text-white font-bold text-sm">Query Explorer</span>
          </div>
        </div>

        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      {/* Workspace fills the rest */}
      <QueryWorkspace />
    </div>
  )
}
