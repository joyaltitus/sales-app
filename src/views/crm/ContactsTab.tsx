import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useContacts } from '../../lib/crm-data'
import { waitStamp } from '../../lib/wait'
import { Avatar } from '../../ui/Avatar'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'

// Contacts — REAL as of SA-05 (crm-data.useContacts: the `contacts` read
// Workbench already issues browser-side under RLS). Search, channel filter,
// VIP/opted-out flags. Last activity column arrives when a cheap source for
// it exists; showing created-at instead of a wrong number.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

export function ContactsTab() {
  const { activeClient } = useClient()
  const { items } = useContacts(activeClient?.id ?? null)
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState<'' | 'whatsapp' | 'instagram'>('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((c) => {
      if (channel && c.channel !== channel) return false
      if (!q) return true
      return (
        (c.profile_name?.toLowerCase().includes(q) ?? false) ||
        c.external_id.toLowerCase().includes(q)
      )
    })
  }, [items, query, channel])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-subtle"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or number"
            aria-label="Search contacts"
            className="h-8 w-full max-w-sm rounded-md border border-border bg-surface pr-2 pl-8 text-xs text-fg transition-colors placeholder:text-fg-subtle hover:border-border-strong"
          />
        </div>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
          aria-label="Channel filter"
          className="h-8 shrink-0 rounded-md border border-border bg-surface px-2 text-xs text-fg-muted hover:border-border-strong"
        >
          <option value="">All channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No matches." body="Clear the search or switch channels." />
          </div>
        ) : (
          visible.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3"
            >
              <Avatar name={c.profile_name ?? c.external_id} profile={c.profile} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-fg">
                    {c.profile_name ?? 'Unknown contact'}
                  </span>
                  <span
                    className="shrink-0 text-2xs text-fg-subtle uppercase"
                    style={capsStyle}
                    aria-label={c.channel === 'instagram' ? 'Instagram' : 'WhatsApp'}
                  >
                    {c.channel === 'instagram' ? 'IG' : 'WA'}
                  </span>
                  {c.is_vip && <Chip tone="accent">VIP</Chip>}
                  {c.is_opted_out && <Chip tone="danger">Opted out</Chip>}
                </div>
                <div className="mt-0.5 flex items-center gap-3">
                  <span
                    className="tnum truncate text-xs text-fg-subtle"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {c.external_id}
                  </span>
                  {c.notes && <span className="truncate text-xs text-fg-muted">{c.notes}</span>}
                </div>
              </div>
              <span
                className="tnum shrink-0 text-sm text-fg-subtle"
                style={{ fontFamily: 'var(--font-mono)' }}
                title="Contact age"
              >
                {waitStamp(c.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
