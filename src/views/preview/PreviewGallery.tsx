import type { ReactNode } from 'react'
import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  Flame,
  MessageCircle,
  Moon,
  Phone,
  ListTodo,
  Search,
  Sparkles,
  Sun,
  Trophy,
} from 'lucide-react'
import { useTheme } from '../../shell/theme'
import { ProductMark } from '../../ui/ProductMark'
import { NotificationCenter } from '../../ui/NotificationCenter'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Input } from '../../ui/Input'
import { QueueRow } from '../inbox/QueueRow'
import { Thread } from '../inbox/Thread'
import { AgentPanel } from '../agent/AgentPanel'
import { Panel, Funnel } from '../dashboard/charts'
import { MOCK_QUEUE, MOCK_MESSAGES, MOCK_TRACES, MOCK_FUNNEL } from './preview-mocks'
import { ObjectionCapture } from '../objections/ObjectionCapture'
import { Playbook } from '../docs/Playbook'
import { ObjectionsReview } from '../dashboard/ObjectionsReview'
import { TODO_PREVIEW_ITEMS, TODO_REPS } from '../crm/todoMocks'
import { Avatar } from '../../ui/Avatar'
import { CallButton } from '../calls/CallButton'
import { RelationshipTimeline } from '../crm/RelationshipTimeline'
import { EmailQueueRow } from '../email/EmailQueueRow'
import EmailConversation from '../email/EmailConversation'
import { ForecastWidget } from '../revenue/ForecastWidget'
import SettingsPanel from '../rep/SettingsPanel'
import MySeason from '../momentum/MySeason'
import CompetitionConsole from '../momentum/CompetitionConsole'
import { MomentumCard } from '../momentum/RepMomentum'
import { AuthExperiencePreview } from '../../auth/LoginPage'
import OwnerBusinessReport from '../reports/OwnerBusinessReport'

function Section({ number, title, note, children }: { number: string; title: string; note: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-10 first:border-0">
      <div className="mb-5 grid gap-2 sm:grid-cols-[80px_1fr]">
        <span className="tnum text-xs font-semibold text-accent">{number}</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.035em] text-fg">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">{note}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full overflow-hidden rounded-[28px] border-[6px] border-fg bg-canvas shadow-elev-3 sm:w-[390px]">
      <div className="mx-auto mt-2 h-1.5 w-16 rounded-pill bg-fg opacity-20" />
      {children}
    </div>
  )
}

function TodayPreview() {
  return (
    <PhoneFrame>
      <div className="px-4 pt-5 pb-6">
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-semibold text-accent">Your day is ready</p><h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Good morning.</h3></div>
          <Chip tone="accent"><Flame aria-hidden size={11} /> 4 days</Chip>
        </div>
        <div className="relative mt-4 overflow-hidden rounded-xl border border-accent/20 bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-5 shadow-elev-2">
          <p className="label-caps text-accent">Do this now</p>
          <h4 className="mt-3 text-xl font-semibold tracking-[-0.03em]">Reply to Anjali</h4>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">“Can I pay the fee in two parts?”</p>
          <Button size="lg" className="mt-5 w-full"><MessageCircle aria-hidden size={16} /> Reply now <ArrowRight aria-hidden size={14} /></Button>
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-elev-1">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-pill border-[7px] border-accent"><strong className="tnum text-md">71%</strong></div>
          <div><p className="label-caps">Daily momentum</p><p className="mt-1 text-sm font-semibold">5 of 7 follow-ups done</p><p className="mt-1 text-xs text-fg-muted">Two more keeps your streak alive.</p></div>
        </div>
        <div className="mt-5"><p className="label-caps">Then keep moving</p><h4 className="mt-1 text-lg font-semibold">Your priority stack</h4></div>
        <div className="mt-3 space-y-2">
          {[
            [Phone, 'Overdue follow-up', 'Call Vishnu before the promise slips'],
            [Sparkles, 'Going cold · 6 days', 'Draft a relevant re-engagement'],
            [Check, 'Manager todo', 'Confirm Saturday’s campus visit'],
          ].map(([Icon, meta, title]) => (
            <div key={String(meta)} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-elev-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent"><Icon aria-hidden size={16} /></span>
              <span className="min-w-0 flex-1"><span className="label-caps block">{meta as string}</span><span className="mt-1 block truncate text-sm font-semibold">{title as string}</span></span>
              <ArrowRight aria-hidden size={15} className="text-fg-subtle" />
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}

function FloorPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-canvas shadow-elev-2">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-4"><ProductMark size={34} /><div><p className="text-sm font-semibold">Acme admissions</p><p className="text-2xs text-fg-muted">Sales operations</p></div><div className="ml-auto flex items-center gap-2"><Input className="hidden w-56 lg:block" placeholder="Search or jump to…" /><NotificationCenter /></div></div>
      <div className="app-grid p-5">
        <p className="text-xs font-semibold text-success">● Live floor</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Know where to step in.</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[['Follow-ups on time', '88%', 'team today'], ['Customers waiting', '7', '2 over 15m'], ['Human handovers', '2', 'not picked up']].map(([label, value, detail]) => <div key={label} className="rounded-lg border border-border bg-surface p-4 shadow-elev-1"><p className="label-caps">{label}</p><strong className="tnum mt-2 block text-2xl">{value}</strong><p className="mt-1 text-2xs text-fg-muted">{detail}</p></div>)}
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="label-caps text-danger">Needs your decision</p><h4 className="mt-1 font-semibold">Clear these blockers first</h4></div><Chip tone="danger">3 open</Chip></div>
          {[
            [Bot, 'Approve Anjali’s quotation', 'AI prepared the exact approved terms.'],
            [Clock3, 'Vishnu needs a human owner', 'Bot handed over and stopped.'],
          ].map(([Icon, title, detail]) => <div key={String(title)} className="flex items-center gap-3 border-b border-border p-4 last:border-0"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-warn-subtle text-warn"><Icon aria-hidden size={16} /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title as string}</p><p className="mt-1 text-xs text-fg-muted">{detail as string}</p></div><Button variant="ghost" size="sm">Resolve</Button></div>)}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2"><Panel title="Pipeline health"><Funnel stages={MOCK_FUNNEL} /></Panel><div className="rounded-lg border border-border bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-5"><Trophy aria-hidden className="text-accent" /><p className="label-caps mt-4 text-accent">Personal-best pace</p><h4 className="mt-2 text-lg font-semibold">Fast replies are creating visits.</h4><p className="mt-2 text-xs text-fg-muted">Answered within 15 minutes converts 2.4× more often.</p></div></div>
      </div>
    </div>
  )
}

function TodoBoardPreview() {
  return (
    <div className="rounded-xl border border-border bg-canvas p-4 shadow-elev-2">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label-caps text-accent">Manager assignment desk · Preview</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Push the next action, not another message.</h3></div><Button><ListTodo aria-hidden size={15} /> Full assignment</Button></div>
      <div className="mt-4 flex gap-2 rounded-xl border border-border bg-surface p-3 shadow-elev-1"><Input className="min-w-0 flex-1" placeholder="Assign a todo…" /><Button variant="secondary">Asha · Today</Button><Button>Assign</Button></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">{TODO_REPS.map((rep) => { const assigned = TODO_PREVIEW_ITEMS.filter((item) => item.assignees.includes(rep.name)); return <section key={rep.id} className="rounded-xl border border-border bg-surface-sunk p-2"><header className="flex items-center gap-2 px-2 py-2"><Avatar name={rep.name} size="sm" /><div className="min-w-0"><p className="truncate text-xs font-semibold">{rep.name}</p><p className="text-2xs text-fg-subtle">{assigned.filter((item) => item.status === 'open').length} open</p></div></header><div className="space-y-2">{assigned.slice(0, 2).map((item) => <article key={item.id} className={['rounded-lg border bg-surface p-3 shadow-elev-1', item.overdue ? 'border-danger/30' : 'border-border'].join(' ')}><div className="flex gap-2"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-strong text-transparent"><Check aria-hidden size={12} /></span><div><p className="text-xs font-semibold leading-relaxed">{item.title}</p><p className={['mt-2 text-2xs font-semibold', item.overdue ? 'text-danger' : 'text-fg-muted'].join(' ')}>{item.overdue ? 'Overdue · ' : ''}{item.dueLabel}</p></div></div></article>)}</div></section> })}</div>
    </div>
  )
}

export default function PreviewGallery() {
  const { theme, toggle } = useTheme()
  return (
    <div className="min-h-full bg-canvas text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-glass backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <ProductMark />
          <div className="min-w-0 flex-1"><h1 className="text-sm font-semibold">Sales app design review</h1><p className="text-2xs text-fg-muted">Operational calm · spruce action · mint signal</p></div>
          <button onClick={toggle} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-fg-muted hover:bg-surface-sunk hover:text-fg">{theme === 'dark' ? <Sun aria-hidden size={15} /> : <Moon aria-hidden size={15} />}{theme === 'dark' ? 'Light' : 'Dark'}</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4">
        <section className="grid min-h-[380px] items-center gap-8 py-12 lg:grid-cols-[1fr_1.2fr]">
          <div><p className="label-caps text-accent">Design system vNext</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.055em] text-fg">Less dashboard.<br />More momentum.</h2><p className="mt-4 max-w-lg text-md leading-relaxed text-fg-muted">One product language tuned in two directions: decisive and spacious for a rep’s phone, exception-dense for a manager’s floor.</p><div className="mt-6 flex flex-wrap gap-2"><Chip tone="accent">One action</Chip><Chip>AA contrast</Chip><Chip>Dark mode</Chip><Chip>4px rhythm</Chip></div></div>
          <div className="grid grid-cols-5 gap-2 rounded-xl border border-border bg-surface p-4 shadow-elev-2">{['#146b4a', '#8dddaf', '#f2f4f1', '#fafbf9', '#17201c'].map((color, index) => <div key={color}><div className="aspect-square rounded-lg border border-border" style={{ background: color }} /><p className="tnum mt-2 text-center text-2xs text-fg-muted">{index < 2 ? 'signal' : index === 2 ? 'canvas' : index === 3 ? 'surface' : 'ink'}</p></div>)}</div>
        </section>

        <Section number="01" title="Rep Today" note="One live next action, daily momentum, then at most three priorities. Every object can be acted on."><TodayPreview /></Section>
        <Section number="02" title="Manager Floor" note="Exceptions and decisions appear before pipeline data. Healthy activity stays quiet."><FloorPreview /></Section>
        <Section number="03" title="Inbox" note="Customer, AI and human handling are distinguishable without turning the conversation into an audit log.">
          <div className="grid overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2 lg:grid-cols-[360px_1fr]">
            <div className="border-r border-border"><div className="space-y-3 border-b border-border p-4"><h3 className="text-lg font-semibold">Inbox</h3><div className="relative"><Search aria-hidden size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" /><Input className="pl-9" placeholder="Search conversations" /></div></div>{MOCK_QUEUE.map(({ item, preview, assignee }) => <QueueRow key={item.id} item={item} preview={preview} selected={item.id === MOCK_QUEUE[0].item.id} onSelect={() => {}} assigneeLabel={assignee} />)}</div>
            <div className="app-grid min-h-[560px] overflow-hidden"><div className="border-b border-border bg-surface px-4 py-3"><p className="font-semibold">Anjali Ramesh</p><p className="text-2xs text-success">● AI monitoring</p></div><Thread messages={MOCK_MESSAGES} traces={MOCK_TRACES} /></div>
          </div>
        </Section>
        <Section number="04" title="AI sales copilot" note="Typed tool actions, explicit autonomy, recognition and approvals make the system feel capable without asking for blind trust."><div className="mx-auto h-[640px] max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-elev-3"><AgentPanel /></div></Section>
        <Section number="05" title="Capture → counter-script" note="A detected objection is confirmed in one tap; the company’s standard answer appears immediately as the reward.">
          <PhoneFrame><div className="min-h-[520px] bg-canvas px-3 pt-24"><div className="rounded-xl border border-border bg-surface p-3 shadow-elev-1"><p className="text-xs text-fg-muted">Customer: “The fee feels higher than the other academy.”</p></div><div className="mt-40 overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2"><ObjectionCapture contactId="preview-contact" source="chat" detected="price" compact onInsertScript={() => undefined} /><div className="border-t border-border p-3"><Input placeholder="Message customer…" /></div></div></div></PhoneFrame>
        </Section>
        <Section number="06" title="The Playbook" note="A living company standard: library, versioned editor, taxonomy governance and a day-one reading view."><Playbook canManage /></Section>
        <Section number="07" title="Monday objection review" note="Frequency, capture behavior and script outcomes converge in a meeting mode with one decision per screen."><ObjectionsReview /></Section>
        <Section number="08" title="Manager todo push" note="Keyboard-fast assignment, visible team load and the same action language reps receive on Today."><TodoBoardPreview /></Section>
        <Section number="09" title="Click-to-call and relationship history" note="Every call starts with a 15-second brief, returns into a two-tap outcome capture, and becomes part of the same customer timeline.">
          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
            <PhoneFrame><div className="min-h-[620px] bg-canvas p-4"><p className="label-caps text-accent">Call layer · Preview</p><div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-elev-2"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-fg">Anjali Ramesh</h3><p className="mt-1 text-xs text-fg-muted">Qualified · Price objection open</p></div><strong className="tnum text-md text-fg">₹60,000</strong></div><p className="mt-4 text-xs leading-relaxed text-fg-muted">Recommended: confirm the two-instalment plan, then ask for the decision.</p><div className="mt-4"><CallButton person="Anjali Ramesh" phone="+91 98765 42018" dealValue={60000} variant="primary" label="Brief me, then call" /></div></div><div className="mt-4 rounded-xl border border-dashed border-border-strong p-4"><p className="text-xs font-semibold text-fg">Try the complete flow</p><p className="mt-1 text-2xs leading-relaxed text-fg-muted">Brief → mock call → automatic outcome → objection or callback detail.</p></div></div></PhoneFrame>
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-elev-2"><RelationshipTimeline contactId="preview-contact-anjali" /></div>
          </div>
        </Section>
        <Section number="10" title="Email joins the unified Inbox" note="A subject-led queue row opens a true email thread with long-form bodies, attachments, collapsed quotes, templates and reviewed AI drafting.">
          <div className="grid h-[780px] overflow-hidden rounded-xl border border-border bg-surface shadow-elev-2 lg:grid-cols-[360px_minmax(0,1fr)]"><aside className="hidden border-r border-border bg-surface lg:block"><div className="border-b border-border p-4"><p className="label-caps text-info">Unified queue · Preview</p><h3 className="mt-1 text-lg font-semibold text-fg">Email, WhatsApp, Instagram</h3></div><EmailQueueRow selected onSelect={() => undefined} /></aside><EmailConversation canSend onBack={() => undefined} /></div>
        </Section>
        <Section number="11" title="Revenue operating view" note="Weighted stage value, forecast scenarios, target pace and a copilot read focus the manager on the deals that can still change the month."><ForecastWidget /></Section>
        <Section number="12" title="Connections and control" note="Gmail, client-level copilot autonomy and high-signal notifications sit in a searchable settings architecture with honest connection states."><div className="mx-auto max-w-2xl rounded-xl border border-border bg-canvas p-5 shadow-elev-2"><SettingsPanel /></div></Section>
        <Section number="13" title="Rep momentum and My Season" note="Every visibility mode preserves a path to a good day. Points explain themselves, quiet hours remove pressure, and achievement stays restrained."><div className="grid gap-3 xl:grid-cols-4"><div><p className="label-caps mb-2">Full board policy</p><MomentumCard visibility="full_board" /></div><div><p className="label-caps mb-2">Top-3 policy</p><MomentumCard visibility="top_three" /></div><div><p className="label-caps mb-2">Private policy</p><MomentumCard visibility="private" /></div><div><p className="label-caps mb-2">Quiet hours</p><MomentumCard visibility="full_board" quietHours /></div></div><div className="mx-auto mt-8 max-w-2xl"><MySeason /></div></Section>
        <Section number="14" title="Manager Momentum console" note="Rules, challenge design, both leagues, rookie ramp and care signals live under one manager-controlled policy with a rep preview beside every consequential setting."><CompetitionConsole /></Section>
        <Section number="15" title="First impressions and auth edges" note="A mature product promise frames sign-in, while invite acceptance, recovery, failure and session-expiry states protect context and explain exactly what happens next."><AuthExperiencePreview /></Section>
        <Section number="16" title="Owner business report" note="Revenue, coverage, execution, bookings and buyer objections resolve into a one-page renewal artifact built for a 30-second read and a clean A4 handoff."><OwnerBusinessReport /></Section>
      </main>
    </div>
  )
}
