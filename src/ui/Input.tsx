import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

// Hairline border elevation (§C), focus ring from global rule. States: default,
// hover, focus, disabled, invalid, loading (caller renders alongside).
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { invalid, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={[
        'h-10 w-full rounded-md border bg-surface px-3 text-sm text-fg tnum',
        'placeholder:text-fg-subtle transition-colors',
        'hover:border-border-strong',
        'disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:opacity-60',
        invalid ? 'border-danger' : 'border-border',
        className,
      ].join(' ')}
      {...rest}
    />
  )
})
