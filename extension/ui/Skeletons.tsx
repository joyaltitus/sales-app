import { Skeleton } from '../../src/ui/Skeleton'

// A rep on a train opens this panel into a slow connection more often than
// into a warm cache, so the loading frame IS the interface most of the time.
// Every block below is sized to the real thing it stands in for: when the data
// lands the layout does not move, it just gains ink.

/** Matches TargetBar: min-h-10 + py-2 + bottom hairline. */
export function TargetSkeleton() {
  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-border bg-surface px-3 py-2" role="status" aria-label="Loading your target">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-1.5 h-1 w-full rounded-pill" />
      </div>
      <div className="shrink-0 space-y-1">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  )
}

/** Matches ListRow: px-4 py-3.5, two text lines, bottom hairline. */
function RowSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <Skeleton className={['h-3.5', wide ? 'w-36' : 'w-28'].join(' ')} />
        <Skeleton className="mt-1.5 h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-14 rounded-pill" />
    </div>
  )
}

/** Search bar + target + Next + rows, at the exact heights QueueScreen uses. */
export function QueueSkeleton() {
  return (
    <div role="status" aria-label="Loading your queue">
      <div className="border-b border-border bg-surface px-3 py-2">
        <Skeleton className="h-10 w-full" />
      </div>
      <TargetSkeleton />
      <div className="px-3 pt-2 pb-1">
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="mt-1">
        {[true, false, true, false, true].map((wide, i) => (
          <RowSkeleton key={i} wide={wide} />
        ))}
      </div>
    </div>
  )
}

/**
 * Three collapsed disclosure rows, the same 44px each that Facts / Objections /
 * History settle at. The during-call block above never waits on this data, so
 * only the reference stack needs holding open.
 */
export function ReferenceSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading lead history">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <Skeleton className="h-3.5 w-3.5 rounded-sm" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      ))}
    </div>
  )
}

/** Script cards, at ScriptCard's own padding and rhythm. */
export function LibrarySkeleton() {
  return (
    <div className="space-y-3 p-3" role="status" aria-label="Loading library">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-surface-raised p-3 shadow-elev-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2.5 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}
