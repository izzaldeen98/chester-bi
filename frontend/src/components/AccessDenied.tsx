import { motion } from 'framer-motion'
import { ShieldOff, Mail } from '../lib/icons'

interface AccessDeniedProps {
  permission?: string
}

export default function AccessDenied({ permission }: AccessDeniedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center"
    >
      {/* Icon */}
      <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <ShieldOff className="w-9 h-9 text-red-400" />
      </div>

      {/* Heading */}
      <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Access Denied</h2>
      <p className="text-gray-500 dark:text-white/40 text-sm max-w-sm leading-relaxed mb-2">
        You don&apos;t have permission to view this page.
      </p>
      {permission && (
        <p className="text-gray-400 dark:text-white/25 text-xs font-mono mb-6">
          Required permission: <span className="text-yellow-400/60">{permission}</span>
        </p>
      )}

      {/* Contact card */}
      <div className="mt-4 flex items-start gap-3 px-5 py-4 rounded-2xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 max-w-sm text-left">
        <div className="w-8 h-8 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 flex-shrink-0 mt-0.5">
          <Mail className="w-4 h-4" />
        </div>
        <div>
          <p className="text-gray-900 dark:text-white text-sm font-semibold mb-0.5">Contact your administrator</p>
          <p className="text-gray-500 dark:text-white/40 text-xs leading-relaxed">
            Ask your account administrator to grant you the required permissions to access this section.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
