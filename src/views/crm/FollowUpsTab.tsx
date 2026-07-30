import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useFollowUps, useLeads } from '../../lib/leads-data'
import type { FollowUpItem } from '../../lib/leads-data'
import { updateFollowUp } from '../../lib/crm-actions'
import { EmptyState } from '../../ui/EmptyState'

// Follow-ups — REAL reads AND, as of SA-06, REAL actions (done / snooze),
// visible to manager and employee alike. Writes are conditional on the
// rendered status; RLS decides who may complete what, and a denied write says
// so inline (the 0-row contract). Buckets match Workbench's date math.

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

type Bucket = { label: string; tone: string; items: FollowUpItem[] }

function dueStamp(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const m = Math.max(1, Math.round(abs / 60_000))
  const stamp = m < 60 ? `${m}m` : m < 24 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / (24 * 60))}d`
  return diff < 0 ? `${stamp} late` : `in ${stamp}`
}

export function FollowUpsTab() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const { items: followUps, reload } = useFollowUps(clientId)
  const { items: leads, loading } = useLeads(clientId)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [errId, setErrId] = useState<string | null>(null)
  const act = async (f: FollowUpItem, action: 'done' | 'snooze1d' | 'snooze3d') => {
    if (!clientId || busyId) return
    setBusyId(f.id)
    setErrId(null)
    const res = await updateFollowUp(clientId, f.id, f.status, action)
    setBusyId(null)
    if (!res.ok) {
      setErrId(f.id)
      return
    }
    void reload()
  }

  const nameByLead = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of leads) {
      m.set(l.id, l.contact?.profile_name ?? l.contact?.external_id ?? 'Unknown contact')
    }
    return m
  }, [leads])

  const buckets = useMemo<Bucket[]>(() => {
    const now = Date.now()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    const overdue: FollowUpItem[] = []
    const today: FollowUpItem[] = []
    const upcoming: FollowUpItem[] = []
    for (const f of followUps) {
      const due = new Date(f.due_at).getTime()
      if (due < now) overdue.push(f)
      else if (due <= end.getTime()) today.push(f)
      else upcoming.push(f)
    }
    return [
      { label: 'Overdue', tone: 'text-danger', items: overdue },
      { label: 'Due today', tone: 'text-fg', items: today },
      { label: 'Upcoming', tone: 'text-fg-subtle', items: upcoming },
    ]
  }, [followUps])

  const now = Date.now()

  if (!loading && followUps.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="Nothing waiting."
          body="Follow-ups appear here when a lead has a next step scheduled."
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {buckets.map(
          (b) =>
            b.items.length > 0 && (
              <section key={b.label}>
                <h2
                  className={['border-b border-border bg-surface-sunk px-4 py-1.5 text-2xs uppercase', b.tone].join(' ')}
                  style={capsStyle}
                >
                  {b.label}
                  <span className="tnum ml-2" style={monoStyle}>
                    {b.items.length}
                  </span>
                </h2>
                {b.items.map((f) => (
                  <div key={f.id} className="border-b border-border bg-surface px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-semibold text-fg">
                            {(f.lead_id && nameByLead.get(f.lead_id)) ?? 'Unlinked contact'}
                          </span>
                          {f.status === 'snoozed' && (
                            <span className="shrink-0 text-2xs text-fg-subtle uppercase" style={capsStyle}>
                              Snoozed
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-fg-muted">{f.note}</div>
                      </div>
                      <span
                        className={[
                          'tnum shrink-0 text-sm',
                          b.label === 'Overdue' ? 'text-danger' : 'text-fg-subtle',
                        ].join(' ')}
                        style={monoStyle}
                      >
                        {dueStamp(f.due_at, now)}
                      </span>
                      {/* Actions: complete first — the accenting event of this
                          list — then quiet snoozes. */}
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => void act(f, 'done')}
                          disabled={busyId === f.id}
                          aria-label={`Mark follow-up done: ${f.note}`}
                          title="Done"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:border-transparent hover:bg-accent-subtle hover:text-accent disabled:opacity-50"
                        >
                          <Check aria-hidden size={14} strokeWidth={2.25} />
                        </button>
                        <button
                          onClick={() => void act(f, 'snooze1d')}
                          disabled={busyId === f.id}
                          className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-50"
                        >
                          +1d
                        </button>
                        <button
                          onClick={() => void act(f, 'snooze3d')}
                          disabled={busyId === f.id}
                          className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-50"
                        >
                          +3d
                        </button>
                      </span>
                    </div>
                    {errId === f.id && (
                      <p className="mt-1.5 text-2xs text-danger">
                        That didn't go through — no permission, or it changed elsewhere.
                      </p>
                    )}
                  </div>
                ))}
              </section>
            ),
        )}
      </div>
    </div>
  )
}
