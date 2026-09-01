import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger'

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone
  children: ReactNode
}

// Status pill — the ONLY place pills are allowed (§C). Weight-shift + tint,
// never a color flood.
const tones: Record<Tone, string> = {
  neutral: 'border-border bg-surface-sunk text-fg-muted',
  accent: 'border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-accent-subtle text-accent',
  success: 'border-[color-mix(in_srgb,var(--success)_20%,transparent)] bg-success-subtle text-success',
  warn: 'border-[color-mix(in_srgb,var(--warn)_20%,transparent)] bg-warn-subtle text-warn',
  danger: 'border-[color-mix(in_srgb,var(--danger)_20%,transparent)] bg-danger-subtle text-danger',
}

export function Chip({ tone = 'neutral', className = '', children, ...rest }: Props) {
  return (
    <span
      className={[
        'inline-flex min-h-5 items-center gap-1 whitespace-nowrap rounded-pill border px-2 py-0.5 text-2xs leading-none font-semibold',
        tones[tone],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
}
