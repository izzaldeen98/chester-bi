interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizes: Record<NonNullable<SpinnerProps['size']>, string> = {
  xs: 'w-3 h-3 border-[1.5px]',
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-2',
}

/**
 * Headless spinner — pass border colours via `className`.
 * Example: <Spinner className="border-black/20 border-t-black" />
 */
export function Spinner({ size = 'sm', className = '' }: SpinnerProps) {
  return (
    <div className={`${sizes[size]} rounded-full animate-spin ${className}`} />
  )
}
