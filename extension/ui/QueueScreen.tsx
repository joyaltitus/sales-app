import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { QueueItem } from '../lib/contracts'
import { Button } from '../../src/ui/Button'
import { Chip } from '../../src/ui/Chip'
import { EmptyState } from '../../src/ui/EmptyState'
import { Input } from '../../src/ui/Input'
import { ListRow } from '../../src/ui/ListRow'
import { StaleChip } from './StaleChip'
import { formatClock } from './time'

type Props = {
  items: QueueItem[]
  target?: ReactNode
  staleAt?: string | null
  onNext: (item: QueueItem) => void
  onOpenLead: (item: QueueItem) => void
}

const REASON_TONE: Record<QueueItem['reason'], 'neutral' | 'accent' | 'success' | 'danger'> = {
  overdue: 'danger',
  due: 'accent',
  new: 'success',
  idle: 'neutral',
}

const LIST_CHANNEL = { whatsapp: 'WA', instagram: 'IG' } as const

function matches(item: QueueItem, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  return [item.display_name, item.phone_e164 ?? '', item.stage_label].some((field) =>
    field.toLowerCase().includes(q),
  )
}

export function QueueScreen({ items, target, staleAt, onNext, onOpenLead }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query])
  const top = filtered[0] ?? null

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-border bg-surface px-3 py-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or number…"
          aria-label="Search leads"
        />
      </div>

      {target}

      {staleAt && (
        <div className="flex min-h-8 flex-wrap items-center gap-2 px-3 pt-2">
          <StaleChip fetched_at={staleAt} />
        </div>
      )}

      {top && (
        <div className="px-3 pb-1 pt-2">
          <Button
            size="lg"
            className="h-12 w-full"
            onClick={() => onNext(top)}
            aria-label={`Open next lead: ${top.display_name}`}
          >
            Next · {top.display_name}
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        query.trim() ? (
          <EmptyState title={`No match for “${query.trim()}”`} body="Check the number or try the name." />
        ) : (
          <EmptyState title="Nothing due — nice." />
        )
      ) : (
        <ul className="mt-1" aria-label="Today's queue">
          {filtered.map((item) => (
            <li key={item.lead_id}>
              <ListRow
                name={item.display_name}
                preview={item.stage_label}
                channel={LIST_CHANNEL[item.channel as keyof typeof LIST_CHANNEL]}
                assignee={item.owner?.display_name ?? undefined}
                timestamp={
                  item.due_at
                    ? formatClock(item.due_at)
                    : item.last_activity_at
                      ? formatClock(item.last_activity_at)
                      : undefined
                }
                onClick={() => onOpenLead(item)}
                trailing={
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Chip tone={REASON_TONE[item.reason]}>{item.reason}</Chip>
                    <ChevronRight aria-hidden size={14} className="text-fg-subtle" />
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
