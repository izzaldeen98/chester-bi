import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  footer?: React.ReactNode
  children: React.ReactNode
  width?: string
}

export function SlidePanel({
  open,
  onClose,
  title,
  footer,
  children,
  width = 'max-w-sm',
}: SlidePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className={`fixed top-0 right-0 z-50 h-screen w-full ${width} bg-[#111111] border-l border-white/10 flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <p className="text-white font-bold">{title}</p>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {children}
            </div>

            {/* Optional footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-white/5">
                {footer}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
