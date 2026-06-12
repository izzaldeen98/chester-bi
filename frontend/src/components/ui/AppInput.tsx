import { useState, forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/utils'

// ── Base field shell ──────────────────────────────────────────────────────────

interface FieldShellProps {
  label?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

function FieldShell({ label, error, required, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">
          {label}
          {required && <span className="text-yellow-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

const inputBase = [
  'w-full rounded-xl px-4 py-3 text-sm text-white',
  'bg-white/[0.05] border border-white/10',
  'placeholder:text-white/25',
  'outline-none transition-all duration-200',
  'hover:border-white/25',
  'focus:border-yellow-400 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(250,204,21,0.12)]',
].join(' ')

// ── AppInput ──────────────────────────────────────────────────────────────────

interface AppInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  password?: boolean
  startContent?: React.ReactNode
  endContent?: React.ReactNode
  wrapperClassName?: string
  isRequired?: boolean
  onValueChange?: (value: string) => void
  value?: string
}

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(
  ({ label, error, password, startContent, endContent, wrapperClassName, isRequired, className, onValueChange, onChange, ...props }, ref) => {
    const [show, setShow] = useState(false)
    const type = password ? (show ? 'text' : 'password') : (props.type ?? 'text')

    const hasLeft = !!startContent
    const hasRight = !!endContent || password

    return (
      <FieldShell label={label} error={error} required={isRequired} className={wrapperClassName}>
        <div className="relative flex items-center">
          {hasLeft && (
            <span className="absolute left-3.5 flex items-center pointer-events-none text-white/30">
              {startContent}
            </span>
          )}
          <input
            {...props}
            ref={ref}
            type={type}
            className={cn(
              inputBase,
              hasLeft && 'pl-10',
              hasRight && 'pr-11',
              className,
            )}
            onChange={(e) => {
              onChange?.(e)
              onValueChange?.(e.target.value)
            }}
          />
          {(password || endContent) && (
            <span className="absolute right-3.5 flex items-center">
              {password ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShow((v) => !v)}
                  className="text-white/30 hover:text-yellow-400 transition-colors"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              ) : (
                <span className="text-white/30">{endContent}</span>
              )}
            </span>
          )}
        </div>
      </FieldShell>
    )
  },
)
AppInput.displayName = 'AppInput'

// ── AppTextarea ───────────────────────────────────────────────────────────────

interface AppTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  wrapperClassName?: string
  isRequired?: boolean
  onValueChange?: (value: string) => void
  value?: string
}

export const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(
  ({ label, error, wrapperClassName, isRequired, className, onValueChange, onChange, ...props }, ref) => {
    return (
      <FieldShell label={label} error={error} required={isRequired} className={wrapperClassName}>
        <textarea
          {...props}
          ref={ref}
          rows={props.rows ?? 3}
          className={cn(inputBase, 'resize-none', className)}
          onChange={(e) => {
            onChange?.(e)
            onValueChange?.(e.target.value)
          }}
        />
      </FieldShell>
    )
  },
)
AppTextarea.displayName = 'AppTextarea'
