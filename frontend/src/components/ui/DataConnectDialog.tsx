import { motion, AnimatePresence } from 'framer-motion'
import { X, Database } from '../../lib/icons'
import { QueryWorkspace } from './QueryWorkspace'
import type { ConnectedModel } from './QueryWorkspace'

export type { ConnectedModel }

interface Props {
  open: boolean
  onClose: () => void
  onConnect: (data: ConnectedModel) => void
  current?: ConnectedModel | null
}

export function DataConnectDialog({ open, onClose, onConnect, current }: Props) {
  function handleConnect(data: ConnectedModel) {
    onConnect(data)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full h-full max-w-[96vw] max-h-[94vh] flex flex-col rounded-2xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 shadow-2xl pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                    <Database className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-bold text-sm leading-tight">Connect Data</p>
                    <p className="text-gray-400 dark:text-white/30 text-xs">Select fields · run query · connect to chart</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Workspace fills the rest */}
              <QueryWorkspace onConnect={handleConnect} current={current} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
