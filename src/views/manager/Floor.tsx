import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  Flame,
  MessageSquareWarning,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useQueue, usePreviews, useLiveRefresh } from '../../lib/inbox-data'
import { waitingLongest, unpickedEscalations } from '../../lib/landing-data'
import { MOCK_MANAGER } from '../../lib/mock-wave3'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { ManagerIntel } from './ManagerIntel'
import { Sheet } from '../../ui/Sheet'

function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'danger' | 'success' }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5 shadow-elev-1">
      <p className="label-caps">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <strong className={[
          'tnum text-2xl leading-none tracking-[-0.04em]',
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-fg',
        ].join(' ')}>{value}</strong>
        <span className="pb-0.5 text-2xs text-fg-muted">{detail}</span>
      </div>
    </div>
  )
}

function ExceptionRow({
  icon: Icon,
  title,
  detail,
  meta,
  to,
  danger = false,
  onAsk,
}: {
  icon: typeof Bot
  title: string
  detail: string
  meta: string
  to: string
  danger?: boolean
  onAsk?: () => void
}) {
  return (
    <article className="group grid gap-3 border-b border-border px-4 py-3.5 last:border-0 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span className={[
        'flex h-9 w-9 items-center justify-center rounded-md',
        danger ? 'bg-danger-subtle text-danger' : 'bg-warn-subtle text-warn',
      ].join(' ')}>
        <Icon aria-hidden size={17} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          <span className="tnum text-2xs font-semibold text-fg-subtle">{meta}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{detail}</p>
      </div>
      <span className="flex items-center gap-1"><button onClick={onAsk} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg"><Sparkles aria-hidden size={12} /> Why?</button><Link to={to} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-subtle">Resolve <ArrowRight aria-hidden size={14} /></Link></span>
    </article>
  )
}

const PRESENCE = [
  { name: 'Anil', note: '12 replies · 2 closes', state: 'on customer call' },
  { name: 'Meera', note: '8 replies · inbox clear', state: 'available' },
  { name: 'Priya', note: '5 replies · 1 overdue', state: 'following up' },
]

export function Floor() {
  const [copilotAsk, setCopilotAsk] = useState<string | null>(null)
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
  const overdue15m = waiting.filter((item) => {
    if (!item.last_customer_message_at) return false
    return Date.now() - new Date(item.last_customer_message_at).getTime() > 15 * 60_000
  })
  const compliance = Math.round(MOCK_MANAGER.followUpCompletion * 100)

  if (loading) {
    return (
      <div className="page-frame space-y-4">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return <div className="p-6"><EmptyState title="Couldn't load the floor" body="Check your connection and try again." /></div>
  }

  const oldest = waiting[0]
  const firstHandover = unpicked[0]
  const combinedLiveException = !!oldest && oldest.id === firstHandover?.id
  const oldestName = oldest?.contact?.profile_name ?? oldest?.contact?.external_id ?? 'Customer'
  const oldestPreview = oldest ? previews.get(oldest.id) ?? 'Waiting for a reply' : ''
  const openDecisionCount = 1 + (firstHandover ? 1 : 0) + (oldest && !combinedLiveException ? 1 : 0)

  return (
    <div className="page-frame space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-success">
            <CircleDot aria-hidden size={12} className="fill-success" /> Live floor
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-fg">Know where to step in.</h1>
          <p className="mt-1 text-sm text-fg-muted">Decisions and risks first. Healthy work stays quiet.</p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="neutral">Preview intelligence</Chip>
          <Link to="/dashboard"><Button variant="secondary" size="sm"><TrendingUp aria-hidden size={15} /> View analytics</Button></Link>
        </div>
      </header>

      <section aria-labelledby="floor-health">
        <h2 id="floor-health" className="sr-only">Floor health</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Follow-ups on time" value={`${compliance}%`} detail="team today" tone={compliance >= 85 ? 'success' : 'danger'} />
          <Metric label="Customers waiting" value={String(waiting.length)} detail={`${overdue15m.length} over 15m`} tone={overdue15m.length ? 'danger' : 'neutral'} />
          <Metric label="Human handovers" value={String(unpicked.length)} detail="not picked up" tone={unpicked.length ? 'danger' : 'success'} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2" aria-labelledby="manager-decisions">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-3.5">
          <div>
            <p className="label-caps text-danger">Needs your decision</p>
            <h2 id="manager-decisions" className="mt-1 text-md font-semibold tracking-[-0.02em] text-fg">Clear these blockers first</h2>
          </div>
          <span className="tnum rounded-pill bg-danger-subtle px-2.5 py-1 text-2xs font-semibold text-danger">{openDecisionCount} open</span>
        </div>

        <ExceptionRow
          icon={Bot}
          title="Approve Anjali’s quotation"
          detail="AI prepared a two-instalment quote. Price and terms are unchanged; it needs one-tap approval before send."
          meta="2m ago · Preview"
          to="/docs"
          onAsk={() => setCopilotAsk('Anjali’s quote is blocked only by approval. The price matches the approved plan, and sending before 2 pm protects today’s promised follow-up.')}
        />
        {firstHandover && (
          <ExceptionRow
            icon={MessageSquareWarning}
            title={`${firstHandover.contact?.profile_name ?? 'Customer'} needs a human owner`}
            detail={combinedLiveException ? `This is also the longest-waiting customer: “${oldestPreview}” Assign one owner and reply now.` : 'The bot handed this conversation over and stopped. Nobody has picked it up yet.'}
            meta={combinedLiveException ? 'Live · longest wait' : 'Live'}
            to={`/inbox?c=${encodeURIComponent(firstHandover.id)}`}
            danger
            onAsk={() => setCopilotAsk('The customer asked a decision question after the bot paused. No rep has taken ownership, so every extra minute now reduces the chance of a same-day response.')}
          />
        )}
        {oldest && !combinedLiveException && (
          <ExceptionRow
            icon={Clock3}
            title={`${oldestName} is waiting longest`}
            detail={`“${oldestPreview}”`}
            meta="Live"
            to={`/inbox?c=${encodeURIComponent(oldest.id)}`}
            danger={overdue15m.includes(oldest)}
            onAsk={() => setCopilotAsk(`${oldestName} has the highest live revenue-weighted wait. The last message contains buying intent and the ₹60,000 deal has no scheduled follow-up.`)}
          />
        )}
        {!oldest && !unpicked.length && (
          <div className="flex items-center gap-3 px-4 py-6 text-sm text-success">
            <CheckCircle2 aria-hidden size={20} /> No customer needs a manager right now.
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <section className="rounded-xl border border-border bg-surface shadow-elev-1" aria-labelledby="team-now">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <p className="label-caps">Team now</p>
              <h2 id="team-now" className="mt-1 text-md font-semibold text-fg">Presence with useful context</h2>
            </div>
            <span className="flex items-center gap-1.5 text-2xs font-semibold text-success"><Users aria-hidden size={13} /> 3 active</span>
          </div>
          <div className="divide-y divide-border">
            {PRESENCE.map((person, index) => (
              <div key={person.name} className="flex items-center gap-3 px-4 py-3.5">
                <span className="relative">
                  <Avatar name={person.name} size="md" />
                  <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-pill border-2 border-surface bg-success" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-fg">{person.name}</p>
                    {index === 0 && <span className="inline-flex items-center gap-1 text-2xs font-semibold text-accent"><Flame aria-hidden size={11} /> personal best pace</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-fg-muted">{person.note}</p>
                </div>
                <button onClick={() => setCopilotAsk(`${person.name} is ${person.state}. ${person.note}. Ask about the current deal mix before changing their queue.`)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg"><MessageCircleQuestion aria-hidden size={13} /> Ask copilot</button>
                <span className="text-2xs text-fg-subtle">{person.state}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-5 shadow-elev-1" aria-labelledby="floor-signal">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-accent shadow-elev-1"><Sparkles aria-hidden size={19} /></div>
          <p className="label-caps mt-4 text-accent">Pattern worth acting on</p>
          <h2 id="floor-signal" className="mt-2 text-lg font-semibold tracking-[-0.025em] text-fg">Fast replies are creating visits.</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{MOCK_MANAGER.winning}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-fg">
            <ShieldCheck aria-hidden size={15} className="text-success" /> Coaching suggestion, not a scorecard
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="label-caps">Deeper readout</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-fg">Pipeline and coaching signals</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-2xs text-fg-muted"><UserRoundCheck aria-hidden size={13} /> Personal-best-first</span>
        </div>
        <ManagerIntel />
      </section>
      <Sheet open={!!copilotAsk} onClose={() => setCopilotAsk(null)} title="Copilot explanation">
        <p className="label-caps text-accent">Why this needs attention · Preview</p><h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-fg">Act on the constraint, not the noise.</h3><p className="mt-3 text-sm leading-7 text-fg-muted">{copilotAsk}</p><div className="mt-5 rounded-lg border border-border bg-surface-sunk p-4"><p className="label-caps">Recommended next</p><p className="mt-2 text-sm font-semibold text-fg">Open the deal, verify the last promise, then approve or assign one owner.</p></div><p className="mt-3 text-2xs text-fg-subtle">Explanation uses sample signals and never changes work automatically.</p>
      </Sheet>
    </div>
  )
}
