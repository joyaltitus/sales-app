import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger'

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone
  children: ReactNode
}

// Status pill — the ONLY place pills are allowed (§C). Weight-shift + tint,
// never a color flood.
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-sunk text-fg-muted',
  accent: 'bg-accent-subtle text-accent',
  success: 'bg-accent-subtle text-success',
  warn: 'bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-warn',
  danger: 'bg-danger-subtle text-danger',
}

export function Chip({ tone = 'neutral', className = '', children, ...rest }: Props) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-semibold',
        tones[tone],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
}
