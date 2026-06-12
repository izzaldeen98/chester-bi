import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react'

export const heroModalClasses = {
  base:     'bg-[#131313] border border-white/10 rounded-2xl',
  backdrop: 'bg-black/60 backdrop-blur-sm',
  header:   'text-white border-b border-white/5 font-bold',
  body:     'py-5',
  footer:   'border-t border-white/5',
} as const

interface AppModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  footer?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'
}

export function AppModal({ isOpen, onClose, title, footer, children, size }: AppModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      scrollBehavior="inside"
      backdrop="blur"
      size={size}
      classNames={heroModalClasses}
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </Modal>
  )
}

export { ModalFooter }
