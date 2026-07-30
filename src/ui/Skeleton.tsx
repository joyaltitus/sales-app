import type { HTMLAttributes } from 'react'

// Skeletons never spinners (§C). Reduced-motion strips the pulse via tokens.css.
export function Skeleton({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={['animate-pulse rounded-sm bg-skeleton', className].join(' ')}
      {...rest}
    />
  )
}
