import { useMemo, useState } from 'react'
import { Mail, Search, Plus } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useContacts } from '../../lib/crm-data'
import type { ContactRow } from '../../lib/crm-data'
import { useLeadStages } from '../../lib/leads-data'
import { waitStamp } from '../../lib/wait'
import { Avatar } from '../../ui/Avatar'
import { Chip } from '../../ui/Chip'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Sheet } from '../../ui/Sheet'
import { CallButton } from '../calls/CallButton'
import { RelationshipTimeline } from './RelationshipTimeline'
import { AddLeadModal } from './AddLeadModal'

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
  const clientId = activeClient?.id ?? null
  const canCreateManualLead = activeClient?.role === 'manager' || activeClient?.role === 'client_admin' || activeClient?.role === 'agent'
  const { items, reload } = useContacts(clientId)
  const { stages } = useLeadStages(clientId)
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState<'' | 'whatsapp' | 'instagram' | 'email'>('')
  const [selected, setSelected] = useState<ContactRow | null>(null)
  const [addLeadOpen, setAddLeadOpen] = useState(false)

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
          <option value="email">Email</option>
        </select>
        {canCreateManualLead && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddLeadOpen(true)}
            className="h-8 shrink-0 gap-1 text-xs font-semibold"
          >
            <Plus aria-hidden size={14} strokeWidth={2} />
            <span>Add Lead</span>
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No matches." body="Clear the search or switch channels." />
          </div>
        ) : (
          visible.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="flex w-full items-center gap-3 border-b border-border bg-surface px-4 py-3 text-left hover:bg-surface-sunk"
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
                    aria-label={c.channel === 'email' ? 'Email' : c.channel === 'instagram' ? 'Instagram' : 'WhatsApp'}
                  >
                    {c.channel === 'email' ? 'EM' : c.channel === 'instagram' ? 'IG' : 'WA'}
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
            </button>
          ))
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Contact relationship">
        {selected && <div>
          <div className="flex items-start gap-3"><Avatar name={selected.profile_name ?? selected.external_id} profile={selected.profile} size="lg" /><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold tracking-[-0.025em] text-fg">{selected.profile_name ?? 'Unknown contact'}</h2><p className="tnum mt-1 text-xs text-fg-muted">{selected.external_id}</p><p className="mt-2 text-xs font-semibold text-fg-muted">Relationship history and next actions</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><CallButton person={selected.profile_name ?? selected.external_id} phone={selected.external_id} dealValue={60000} variant="primary" label="Call with brief" contactId={selected.id} /><button className="inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface-raised text-xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg" title="Preview — email composer"><Mail aria-hidden size={15} /> Email</button></div>
          <div className="mt-6"><RelationshipTimeline contactId={selected.id} /></div>
        </div>}
      </Sheet>

      {clientId && canCreateManualLead && (
        <AddLeadModal
          open={addLeadOpen}
          onClose={() => setAddLeadOpen(false)}
          onCreated={() => void reload()}
          clientId={clientId}
          stages={stages}
        />
      )}
    </div>
  )
}
