import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, BrainCircuit, Users, Sparkles, ChevronRight } from 'lucide-react'
import { dashboardsApi, usersApi } from '../lib/api'

export default function HomePage() {
  const navigate = useNavigate()
  const [dashCount, setDashCount] = useState<number | null>(null)
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    dashboardsApi.list().then((d) => setDashCount(d.length)).catch(() => setDashCount(0))
    usersApi.list().then((u) => setUserCount(u.length)).catch(() => setUserCount(0))
  }, [])

  const stats = [
    { label: 'Dashboards',     value: dashCount, icon: <LayoutDashboard className="w-4 h-4" />, color: 'text-yellow-400' },
    { label: 'Semantic Models', value: 5,         icon: <BrainCircuit className="w-4 h-4" />,    color: 'text-blue-400' },
    { label: 'Team Members',   value: userCount,  icon: <Users className="w-4 h-4" />,           color: 'text-green-400' },
  ]

  const quickActions = [
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Dashboards',
      desc: 'View and create dashboards',
      path: '/home/dashboards',
      iconBg: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400',
      card: 'border-white/10 hover:border-yellow-400/40 hover:bg-yellow-400/[0.03]',
    },
    {
      icon: <BrainCircuit className="w-5 h-5" />,
      label: 'Models',
      desc: 'Manage semantic models',
      path: '/home/models',
      iconBg: 'bg-blue-400/10 border-blue-400/20 text-blue-400',
      card: 'border-white/10 hover:border-blue-400/40 hover:bg-blue-400/[0.03]',
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Users',
      desc: 'Manage team members',
      path: '/home/users',
      iconBg: 'bg-green-400/10 border-green-400/20 text-green-400',
      card: 'border-white/10 hover:border-green-400/40 hover:bg-green-400/[0.03]',
    },
  ]

  return (
    <div>
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h1 className="text-2xl font-black text-white">Welcome to chester-bi</h1>
        </div>
        <p className="text-white/40">Here's an overview of your workspace.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white/[0.03] border border-white/10 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-2 text-white/40">
              {stat.icon}
              <p className="text-sm">{stat.label}</p>
            </div>
            <p className={`text-3xl font-black ${stat.color}`}>
              {stat.value === null ? (
                <span className="inline-block w-12 h-8 rounded bg-white/5 animate-pulse" />
              ) : (
                stat.value
              )}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              onClick={() => navigate(action.path)}
              className={`group text-left p-5 rounded-2xl bg-white/[0.03] border transition-all duration-200 ${action.card}`}
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${action.iconBg}`}>
                {action.icon}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">{action.label}</p>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
              </div>
              <p className="text-white/30 text-sm mt-1">{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
