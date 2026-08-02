import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

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
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md border font-semibold transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-[var(--motion-fast)] ease-[var(--ease)] select-none hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45'

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
  icon: 'h-10 w-10 p-0',
}

const variants: Record<Variant, string> = {
  primary:
    'border-accent bg-accent text-accent-fg shadow-[0_6px_18px_-10px_var(--accent)] hover:border-accent-hover hover:bg-accent-hover active:border-accent-active active:bg-accent-active',
  secondary:
    'border-border-strong bg-surface-raised text-fg shadow-elev-1 hover:border-[color-mix(in_srgb,var(--fg-subtle)_55%,var(--border))] hover:bg-surface active:bg-surface-sunk',
  ghost: 'border-transparent bg-transparent text-fg-muted hover:bg-surface-sunk hover:text-fg active:bg-surface-sunk',
  danger: 'border-danger bg-danger text-danger-fg hover:border-danger-hover hover:bg-danger-hover active:border-danger-active active:bg-danger-active',
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
          className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  )
})
