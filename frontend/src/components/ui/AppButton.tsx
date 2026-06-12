import { Spinner } from './Spinner'

type Variant = 'primary' | 'ghost' | 'danger' | 'secondary' | 'danger-ghost'
type Size    = 'sm' | 'md' | 'lg'

interface AppButtonProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'start' | 'end'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  className?: string
  children?: React.ReactNode
  fullWidth?: boolean
  title?: string
}

const variantCls: Record<Variant, string> = {
  primary:      'bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40',
  ghost:        'bg-transparent text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-40',
  secondary:    'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10 disabled:opacity-40',
  danger:       'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50',
  'danger-ghost': 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50',
}

const sizeCls: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-5 py-3 text-base gap-2 rounded-xl',
}

const spinnerCls: Record<Variant, string> = {
  primary:        'border-black/20 border-t-black',
  ghost:          'border-white/20 border-t-white/60',
  secondary:      'border-white/20 border-t-white/60',
  danger:         'border-white/30 border-t-white',
  'danger-ghost': 'border-red-400/30 border-t-red-400',
}

export function AppButton({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  iconPosition = 'start',
  disabled,
  type = 'button',
  onClick,
  className = '',
  children,
  fullWidth,
  title,
}: AppButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`
        inline-flex items-center justify-center font-semibold transition-all
        disabled:cursor-not-allowed
        ${variantCls[variant]}
        ${sizeCls[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <Spinner size="xs" className={spinnerCls[variant]} />
      ) : (
        iconPosition === 'start' && icon
      )}
      {children}
      {!loading && iconPosition === 'end' && icon}
    </button>
  )
}
