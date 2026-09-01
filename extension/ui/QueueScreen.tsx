import { useEffect, useMemo, useRef, useState } from 'react'
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
import { searchLeads } from '../lib/search-leads'

type Props = {
  items: QueueItem[]
  target?: ReactNode
  staleAt?: string | null
  refreshError?: string | null
  searching?: boolean
  hasMore?: boolean
  onSearch?: (query: string) => void
  onLoadMore?: () => void
  onRetry?: () => void
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

export function QueueScreen({ items, target, staleAt, refreshError, searching, hasMore, onSearch, onLoadMore, onRetry, onNext, onOpenLead }: Props) {
  const [query, setQuery] = useState('')
  const firstSearch = useRef(true)

  useEffect(() => {
    if (!onSearch) return
    if (firstSearch.current) { firstSearch.current = false; return }
    const timer = window.setTimeout(() => onSearch(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [onSearch, query])

  const filtered = useMemo(() => onSearch ? items : searchLeads(items, query), [items, onSearch, query])
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

      {refreshError && items.length > 0 && (
        <div role="alert" className="flex min-h-10 items-center gap-2 bg-warn-subtle px-3 py-2 text-xs text-warn">
          <span className="min-w-0 flex-1">Cached leads are shown. Check your connection, then retry.</span>
          <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      )}

      <div className="min-h-5 px-3 pt-1 text-2xs text-fg-subtle" role="status">
        {searching ? 'Searching all leads…' : query.trim() && onSearch ? `${filtered.length} matching leads` : ''}
      </div>

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
      {hasMore && filtered.length > 0 && (
        <div className="p-3">
          <Button variant="secondary" className="min-h-11 w-full" disabled={searching} onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
