import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Plus, Search } from 'lucide-react'
import type { QueueItem } from '../lib/contracts'
import { Button } from '../../src/ui/Button'
import { Chip } from '../../src/ui/Chip'
import { EmptyState } from '../../src/ui/EmptyState'
import { Input } from '../../src/ui/Input'
import { ListRow } from '../../src/ui/ListRow'
import { StaleChip } from './StaleChip'
import { formatClock } from './time'
import { searchLeads } from '../lib/search-leads'

/** Date windows a rep actually thinks in. `days: null` is "any time". */
export const DATE_FILTERS = [
  { key: 'any', label: 'Any time', days: null },
  { key: 'today', label: 'Today', days: 1 },
  { key: 'week', label: '7 days', days: 7 },
  { key: 'month', label: '30 days', days: 30 },
] as const

export type DateFilterKey = (typeof DATE_FILTERS)[number]['key']

/** ISO cutoff for a filter key, or null for "any time". */
export function sinceFor(key: DateFilterKey, now = new Date()): string | null {
  const filter = DATE_FILTERS.find((item) => item.key === key)
  if (!filter?.days) return null
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - filter.days)
  return cutoff.toISOString()
}

type Props = {
  items: QueueItem[]
  staleAt?: string | null
  refreshError?: string | null
  searching?: boolean
  hasMore?: boolean
  dateFilter: DateFilterKey
  onDateFilter: (key: DateFilterKey) => void
  onSearch?: (query: string) => void
  onLoadMore?: () => void
  onRetry?: () => void
  onAddLead: () => void
  onOpenLead: (item: QueueItem) => void
}

const REASON_TONE: Record<QueueItem['reason'], 'neutral' | 'accent' | 'success' | 'danger'> = {
  overdue: 'danger',
  due: 'accent',
  new: 'success',
  idle: 'neutral',
}

const LIST_CHANNEL = { whatsapp: 'WA', instagram: 'IG' } as const

/**
 * CRM — the whole book, searchable, plus the door to a new lead.
 *
 * Deliberately NOT the queue any more: Home owns "what to do next", so this
 * screen's only job is finding a lead fast and adding one that is missing. The
 * search box is autofocused and the date chips sit under it, because a rep who
 * opens this tab is looking for somebody, not browsing.
 */
export function CrmScreen({
  items, staleAt, refreshError, searching, hasMore, dateFilter, onDateFilter,
  onSearch, onLoadMore, onRetry, onAddLead, onOpenLead,
}: Props) {
  const [query, setQuery] = useState('')
  const firstSearch = useRef(true)

  useEffect(() => {
    if (!onSearch) return
    if (firstSearch.current) { firstSearch.current = false; return }
    const timer = window.setTimeout(() => onSearch(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [onSearch, query])

  // Server search when the panel gave us one; otherwise fall back to filtering
  // what is already on screen, so the box still works offline off the cache.
  const filtered = useMemo(() => onSearch ? items : searchLeads(items, query), [items, onSearch, query])

  return (
    <div>
      <div className="sticky top-0 z-10 space-y-2 border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden size={14} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or number…"
              aria-label="Search leads"
              className="pl-8"
            />
          </div>
          <Button size="sm" className="h-11 shrink-0 px-3" onClick={onAddLead}>
            <Plus aria-hidden size={15} strokeWidth={2.2} />
            Add
          </Button>
        </div>

        {/* Windows ships classic scrollbars, so this row hides its own. */}
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Last activity">
          {DATE_FILTERS.map((filter) => {
            const active = dateFilter === filter.key
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={active}
                onClick={() => onDateFilter(filter.key)}
                className={[
                  'min-h-8 shrink-0 rounded-pill border px-2.5 text-2xs font-semibold whitespace-nowrap transition-colors select-none',
                  active
                    ? 'border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-accent-subtle text-accent'
                    : 'border-border bg-surface-sunk text-fg-muted hover:text-fg',
                ].join(' ')}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      {refreshError && items.length > 0 && (
        <div role="alert" className="flex min-h-10 items-center gap-2 bg-warn-subtle px-3 py-2 text-xs text-warn">
          <span className="min-w-0 flex-1">Cached leads are shown. Check your connection, then retry.</span>
          <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      )}

      <div className="min-h-5 px-3 pt-1 text-2xs text-fg-subtle" role="status">
        {searching
          ? 'Searching all leads…'
          : query.trim() || dateFilter !== 'any'
            ? `${filtered.length} lead${filtered.length === 1 ? '' : 's'}`
            : ''}
      </div>

      {staleAt && (
        <div className="flex min-h-8 flex-wrap items-center gap-2 px-3 pt-2">
          <StaleChip fetched_at={staleAt} />
        </div>
      )}

      {filtered.length === 0 ? (
        query.trim() ? (
          <div>
            <EmptyState title={`No match for “${query.trim()}”`} body="Check the number, or add them as a new lead." />
            <div className="px-3">
              <Button variant="secondary" className="min-h-11 w-full" onClick={onAddLead}>
                Add “{query.trim()}” as a lead
              </Button>
            </div>
          </div>
        ) : dateFilter !== 'any' ? (
          <EmptyState title="Nothing in this window" body="Try a wider date range." />
        ) : (
          <EmptyState title="No leads yet" body="Add the first one." />
        )
      ) : (
        <ul className="mt-1" aria-label="Leads">
          {filtered.map((item) => (
            <li key={item.lead_id}>
              <ListRow
                name={item.display_name}
                snippet={item.stage_label}
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
