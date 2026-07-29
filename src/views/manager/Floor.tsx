import { useMemo } from 'react'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, usePreviews, useLiveRefresh } from '../../lib/inbox-data'
import { waitingLongest, unpickedEscalations } from '../../lib/landing-data'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { SectionHeader, SectionEmpty, ThreadList } from '../landing/LandingSection'

// FLOOR — the manager's landing (§1.11). Two questions, both about the tenant
// as a whole rather than about one rep's list:
//   1. who has waited longest across the floor
//   2. which threads the bot escalated that nobody has picked up
//
// It replaces the old `Team` placeholder outright (Joyal's ruling, SA-03):
// that screen said "No team members yet" and never had data behind it, and a
// third dead door next to Assign and Analytics is worse than none.
//
// Live, unlike the Leads board: a manager watching a floor wants the wait times
// to move. Reuses the Inbox's realtime-plus-poll hook, so a silently-dead
// channel degrades to a 30s refetch rather than to a frozen screen.
export function Floor() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null

  const { items, loading, error, reload } = useQueue(clientId)
  const { previews, reload: reloadPreviews } = usePreviews(clientId)
  useLiveRefresh(clientId, () => {
    void reload()
    void reloadPreviews()
  })

  const waiting = useMemo(() => waitingLongest(items), [items])
  const unpicked = useMemo(() => unpickedEscalations(items), [items])

  if (loading) {
    return (
      <div className="space-y-2 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState title="Couldn't load the floor" body="Check your connection and try again." />
      </div>
    )
  }

  return (
    <div className="pb-6">
      <SectionHeader
        title="Waiting longest"
        count={waiting.length}
        hint="Everyone on the floor, oldest first"
      />
      {waiting.length === 0 ? (
        <SectionEmpty>Nobody is waiting. Every customer has had a reply.</SectionEmpty>
      ) : (
        <ThreadList items={waiting} previews={previews} cap={10} />
      )}

      <SectionHeader
        title="Escalated, not picked up"
        count={unpicked.length}
        hint="Bot handed these over and stopped"
      />
      {unpicked.length === 0 ? (
        <SectionEmpty>Nothing outstanding — every handover has been resolved.</SectionEmpty>
      ) : (
        <ThreadList items={unpicked} previews={previews} cap={10} />
      )}
    </div>
  )
}
