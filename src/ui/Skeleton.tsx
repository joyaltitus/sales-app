import type { HTMLAttributes } from 'react'

// Skeletons never spinners (§C). Reduced-motion strips the pulse via tokens.css.
export function Skeleton({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={[
        'relative overflow-hidden rounded-md bg-skeleton',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_ease-in-out_infinite] after:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--surface-raised)_55%,transparent),transparent)] motion-reduce:after:animate-none',
        className,
      ].join(' ')}
      {...rest}
    />
  )
}
