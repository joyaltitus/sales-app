import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlarmClock,
  ArrowRight,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock3,
  IndianRupee,
  MessageCircle,
  Phone,
  TimerReset,
  UserRound,
} from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useFollowUps, useLeads, useLeadStages } from '../../lib/leads-data'
import type { FollowUpItem, LeadItem } from '../../lib/leads-data'
import { updateFollowUp } from '../../lib/crm-actions'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { FOLLOW_UP_PREVIEW_ITEMS } from './followUpMocks'
import type { FollowUpDetailPreview } from './followUpMocks'

type FollowUpView = FollowUpItem & {
  sample?: true
  person: string
  phone: string
  channel: string
  stage: string
  dealValue: number
  conversationId: string | null
  lastContact: string
  nextAction: string
}

type Bucket = { label: string; tone: string; items: FollowUpView[] }

function isPreview(item: FollowUpItem): item is FollowUpDetailPreview {
  return 'sample' in item && item.sample === true
}

function dueStamp(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const m = Math.max(1, Math.round(abs / 60_000))
  const stamp = m < 60 ? `${m}m` : m < 24 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / (24 * 60))}d`
  return diff < 0 ? `${stamp} late` : `in ${stamp}`
}

function dateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function currency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

function toView(item: FollowUpItem, leads: LeadItem[], stageById: Map<string, string>): FollowUpView {
  if (isPreview(item)) return item
  const lead = item.lead_id ? leads.find((candidate) => candidate.id === item.lead_id) : null
  const contact = lead?.contact
  const lastContactAt = lead?.conversation?.last_customer_message_at
  return {
    ...item,
    person: contact?.profile_name ?? contact?.external_id ?? 'Unlinked contact',
    phone: contact?.external_id ?? 'No contact detail',
    channel: contact?.channel ?? 'unknown',
    stage: lead ? stageById.get(lead.stage_id) ?? 'Stage unavailable' : 'No linked lead',
    dealValue: lead?.est_value ?? 0,
    conversationId: lead?.conversation_id ?? null,
    lastContact: lastContactAt ? `Customer replied ${dateTime(lastContactAt)}` : 'No recent customer message',
    nextAction: lead?.next_action ?? item.note,
  }
}

function SummaryCard({ icon: Icon, value, label, tone = 'neutral' }: { icon: typeof Clock3; value: number; label: string; tone?: 'neutral' | 'danger' | 'success' | 'accent' }) {
  const toneClass = tone === 'danger' ? 'text-danger bg-danger-subtle' : tone === 'success' ? 'text-success bg-success-subtle' : tone === 'accent' ? 'text-accent bg-accent-subtle' : 'text-fg-muted bg-surface-sunk'
  return (
    <article className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-elev-1">
      <span className={['flex h-9 w-9 items-center justify-center rounded-md', toneClass].join(' ')}><Icon aria-hidden size={16} /></span>
      <div><p className="tnum text-lg font-semibold text-fg">{value}</p><p className="text-2xs font-semibold text-fg-muted">{label}</p></div>
    </article>
  )
}

function FollowUpDetails({
  item,
  busy,
  error,
  onAction,
}: {
  item: FollowUpView
  busy: boolean
  error: boolean
  onAction: (action: 'done' | 'snooze1d' | 'snooze3d') => void
}) {
  const overdue = new Date(item.due_at).getTime() < Date.now()
  return (
    <div className="space-y-5" data-testid="follow-up-details">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={overdue ? 'danger' : item.status === 'snoozed' ? 'warn' : 'accent'}>{overdue ? 'Overdue' : item.status === 'snoozed' ? 'Snoozed' : 'Scheduled'}</Chip>
          {item.sample && <span className="text-2xs font-semibold text-fg-subtle">Test data · local only</span>}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-fg">{item.person}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted"><UserRound aria-hidden size={13} /> {item.phone} · {item.channel}</p>
      </div>

      <section className="rounded-lg border border-border bg-surface-sunk p-3">
        <p className="label-caps">Promise to keep</p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-fg">{item.note}</p>
        <p className={['mt-2 flex items-center gap-1.5 text-xs font-semibold', overdue ? 'text-danger' : 'text-fg-muted'].join(' ')}><AlarmClock aria-hidden size={14} /> {dateTime(item.due_at)} · {dueStamp(item.due_at, Date.now())}</p>
      </section>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-surface p-3"><dt className="label-caps">Pipeline stage</dt><dd className="mt-2 text-xs font-semibold text-fg">{item.stage}</dd></div>
        <div className="rounded-lg border border-border bg-surface p-3"><dt className="label-caps">Deal value</dt><dd className="tnum mt-2 text-sm font-semibold text-fg">{item.dealValue ? currency(item.dealValue) : 'Not set'}</dd></div>
      </dl>

      <section>
        <p className="label-caps">Last contact</p>
        <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-xs leading-relaxed text-fg-muted">{item.lastContact}</p>
      </section>
      <section>
        <p className="label-caps text-accent">Recommended next action</p>
        <p className="mt-2 rounded-lg border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-accent-subtle px-3 py-3 text-xs font-semibold leading-relaxed text-fg">{item.nextAction}</p>
      </section>

      {error && <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">That update didn’t go through. Your access may have changed, or the follow-up was edited elsewhere.</p>}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => onAction('done')} disabled={busy}><Check aria-hidden size={15} /> Mark done</Button>
        {item.conversationId && !item.sample ? (
          <Link to={`/inbox?c=${encodeURIComponent(item.conversationId)}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg"><MessageCircle aria-hidden size={15} /> Open chat</Link>
        ) : (
          <button disabled className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface-sunk px-3 text-xs font-semibold text-fg-subtle"><MessageCircle aria-hidden size={15} /> Chat preview</button>
        )}
        <button onClick={() => onAction('snooze1d')} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-50"><TimerReset aria-hidden size={14} /> Tomorrow</button>
        <button onClick={() => onAction('snooze3d')} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-50"><TimerReset aria-hidden size={14} /> In 3 days</button>
      </div>
    </div>
  )
}

export function FollowUpsTab() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const { items: liveFollowUps, loading: followUpsLoading, error: followUpsError, reload } = useFollowUps(clientId)
  const { items: leads, loading: leadsLoading } = useLeads(clientId)
  const { stages, loading: stagesLoading } = useLeadStages(clientId)
  const [searchParams, setSearchParams] = useSearchParams()
  const [sampleItems, setSampleItems] = useState<FollowUpDetailPreview[]>(FOLLOW_UP_PREVIEW_ITEMS)
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('f'))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errId, setErrId] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)

  const loading = followUpsLoading || leadsLoading || stagesLoading
  const usingSample = !loading && liveFollowUps.length === 0
  const sourceItems: FollowUpItem[] = usingSample ? sampleItems : liveFollowUps
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage.label])), [stages])
  const followUps = useMemo(() => sourceItems.map((item) => toView(item, leads, stageById)), [sourceItems, leads, stageById])
  const selected = followUps.find((item) => item.id === selectedId) ?? null

  const openDetail = (id: string | null) => {
    setSelectedId(id)
    const next = new URLSearchParams(searchParams)
    if (id) next.set('f', id)
    else next.delete('f')
    setSearchParams(next, { replace: true })
  }

  const act = async (item: FollowUpView, action: 'done' | 'snooze1d' | 'snooze3d') => {
    if (busyId) return
    setBusyId(item.id)
    setErrId(null)
    setReceipt(null)
    if (item.sample) {
      if (action === 'done') {
        setSampleItems((all) => all.filter((candidate) => candidate.id !== item.id))
        openDetail(null)
        setReceipt(`${item.person} marked done — preview only.`)
      } else {
        const hours = action === 'snooze1d' ? 24 : 72
        setSampleItems((all) => all.map((candidate) => candidate.id === item.id ? { ...candidate, status: 'snoozed', due_at: new Date(Date.now() + hours * 3_600_000).toISOString() } : candidate))
        setReceipt(`${item.person} snoozed ${action === 'snooze1d' ? 'until tomorrow' : 'for 3 days'} — preview only.`)
      }
      setBusyId(null)
      return
    }
    if (!clientId) {
      setBusyId(null)
      setErrId(item.id)
      return
    }
    const result = await updateFollowUp(clientId, item.id, item.status, action)
    setBusyId(null)
    if (!result.ok) {
      setErrId(item.id)
      return
    }
    if (action === 'done') openDetail(null)
    setReceipt(action === 'done' ? `${item.person} marked done.` : `${item.person} snoozed.`)
    void reload()
  }

  const buckets = useMemo<Bucket[]>(() => {
    const now = Date.now()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    const overdue: FollowUpView[] = []
    const today: FollowUpView[] = []
    const upcoming: FollowUpView[] = []
    for (const item of followUps) {
      const due = new Date(item.due_at).getTime()
      if (due < now) overdue.push(item)
      else if (due <= end.getTime()) today.push(item)
      else upcoming.push(item)
    }
    return [
      { label: 'Overdue', tone: 'text-danger', items: overdue },
      { label: 'Due today', tone: 'text-fg', items: today },
      { label: 'Upcoming', tone: 'text-fg-subtle', items: upcoming },
    ]
  }, [followUps])

  if (loading) return <div className="space-y-3 p-4 lg:p-6"><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
  if (followUpsError) return <div className="p-6"><ErrorState title="Couldn’t load follow-ups" body="The live list could not be read. Check the connection and try again." onRetry={() => void reload()} /></div>

  const overdueCount = buckets[0].items.length
  const dueTodayCount = buckets[1].items.length
  const totalValue = followUps.reduce((sum, item) => sum + item.dealValue, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      {usingSample && <p className="border-b border-border bg-surface-sunk px-4 py-1.5 text-2xs font-semibold text-fg-subtle">Preview test data — no live follow-ups were returned. Changes stay on this device.</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="page-frame max-w-[1280px] space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="label-caps text-accent">Promises due</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-fg">Follow up with full context.</h2><p className="mt-1 text-xs text-fg-muted">Open any row to see the contact, deal, history, and next action before you respond.</p></div>
          </header>

          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Follow-up summary">
            <SummaryCard icon={AlarmClock} value={overdueCount} label="Overdue" tone={overdueCount ? 'danger' : 'neutral'} />
            <SummaryCard icon={Clock3} value={dueTodayCount} label="Due today" tone="accent" />
            <SummaryCard icon={CalendarCheck2} value={buckets[2].items.length} label="Upcoming" />
            <SummaryCard icon={IndianRupee} value={Math.round(totalValue / 1000)} label="Pipeline value · ₹k" tone="success" />
          </section>

          {receipt && <p role="status" className="rounded-md border border-[color-mix(in_srgb,var(--success)_25%,var(--border))] bg-success-subtle px-3 py-2 text-xs font-semibold text-success">{receipt}</p>}

          {followUps.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6"><EmptyState icon={Check} title="All follow-ups cleared." body="New promises appear here as they are scheduled from leads and conversations." /></div>
          ) : (
            <div className="grid min-h-[480px] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
                {buckets.map((bucket) => bucket.items.length > 0 && (
                  <section key={bucket.label}>
                    <h3 className={['flex items-center border-b border-border bg-surface-sunk px-4 py-2 text-2xs font-semibold uppercase', bucket.tone].join(' ')}>{bucket.label}<span className="tnum ml-2">{bucket.items.length}</span></h3>
                    {bucket.items.map((item) => (
                      <article key={item.id} className={['border-b border-border p-4 last:border-b-0', selectedId === item.id ? 'bg-accent-subtle' : 'bg-surface hover:bg-surface-sunk'].join(' ')}>
                        <button onClick={() => openDetail(item.id)} className="flex min-h-12 w-full items-start gap-3 text-left" aria-label={`View follow-up details for ${item.person}`}>
                          <span className={['mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md', bucket.label === 'Overdue' ? 'bg-danger-subtle text-danger' : 'bg-accent-subtle text-accent'].join(' ')}><Phone aria-hidden size={16} /></span>
                          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-fg">{item.person}</strong>{item.status === 'snoozed' && <span className="text-2xs font-semibold text-warn">Snoozed</span>}</span><span className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-muted">{item.note}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-fg-subtle"><span>{item.stage}</span>{item.dealValue > 0 && <span className="tnum font-semibold text-fg">{currency(item.dealValue)}</span>}</span></span>
                          <span className="shrink-0 text-right"><span className={['tnum block text-xs font-semibold', bucket.label === 'Overdue' ? 'text-danger' : 'text-fg-muted'].join(' ')}>{dueStamp(item.due_at, Date.now())}</span><ChevronRight aria-hidden size={16} className="ml-auto mt-2 text-fg-subtle" /></span>
                        </button>
                      </article>
                    ))}
                  </section>
                ))}
              </div>

              <aside className="hidden rounded-xl border border-border bg-surface p-5 shadow-elev-1 lg:block">
                {selected ? <FollowUpDetails item={selected} busy={busyId === selected.id} error={errId === selected.id} onAction={(action) => void act(selected, action)} /> : <EmptyState icon={ArrowRight} title="Choose a follow-up" body="The complete contact and deal context will stay here while you work the list." />}
              </aside>
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden"><Sheet open={!!selected} onClose={() => openDetail(null)} title={selected?.person ?? 'Follow-up details'}>{selected && <FollowUpDetails item={selected} busy={busyId === selected.id} error={errId === selected.id} onAction={(action) => void act(selected, action)} />}</Sheet></div>
    </div>
  )
}
