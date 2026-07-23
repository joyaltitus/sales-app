import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

// Six states are all covered: hover/active/disabled via Tailwind state variants,
// focus via the global :focus-visible ring, loading via the `loading` prop,
// empty via callers. No shadow stacks, no gradients (ban list §C).
const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors select-none disabled:cursor-not-allowed disabled:opacity-50'

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active',
  secondary:
    'border border-border-strong bg-surface text-fg hover:bg-surface-sunk active:bg-surface-sunk',
  ghost: 'text-fg-muted hover:bg-surface-sunk hover:text-fg active:bg-surface-sunk',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[base, sizes[size], variants[variant], className].join(' ')}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
})
