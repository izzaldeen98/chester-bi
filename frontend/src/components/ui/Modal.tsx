import { AnimatePresence, motion } from 'framer-motion'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Tailwind max-width class, e.g. "max-w-md" */
  maxWidth?: string
  /** When true, clicking the backdrop does not close the modal */
  disabled?: boolean
  children: React.ReactNode
}

/**
 * Animated modal shell — handles backdrop + panel entrance/exit.
 * Put your content (header, body, footer) directly inside.
 */
export function Modal({ open, onClose, maxWidth = 'max-w-md', disabled, children }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => !disabled && onClose()}
          />
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.16, type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className={`w-full ${maxWidth} bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl pointer-events-auto overflow-hidden`}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
