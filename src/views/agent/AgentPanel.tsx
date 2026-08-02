import { useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, ChevronDown, Command, SendHorizontal, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { Button } from '../../ui/Button'
import { AnchorChip, SampleTag, ToolProgress } from '../../ui/agent/primitives'
import { ApprovalCard } from '../../ui/agent/ApprovalCard'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import {
  AGENT_STARTERS,
  MOCK_AGENT_ACTIVITY,
  MOCK_AGENT_THREAD,
  type AgentMsg,
} from '../../lib/mock-wave3'
import { COPILOT_ACTIONS } from './copilotMocks'
import type { CopilotToolKind, RecognizedCommandPreview } from './copilotMocks'
import { CopilotToolCard } from './CopilotToolCard'

// The AI Sales Agent surface (B-UI shape, mock engine). Action-oriented, not
// a chatbot widget: every run ends in tool receipts and approval cards, and
// the customer anchor is always visible. Desktop = slide-over (Sheet host);
// phone = full-screen route. Same component both places.

function Msg({ m }: { m: AgentMsg }) {
  if (m.role === 'tool')
    return <ToolProgress tool={m.tool} status={m.status} summary={m.summary} />
  if (m.role === 'proposal') return <ApprovalCard proposal={m.proposal} />
  const user = m.role === 'user'
  return (
    <div className={['flex', user ? 'justify-end' : 'justify-start'].join(' ')}>
      <p
        className={[
          'max-w-[88%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-elev-1',
          user ? 'rounded-br-xs bg-accent text-accent-fg' : 'rounded-bl-xs border border-border bg-surface-raised text-fg',
        ].join(' ')}
      >
        {m.text}
      </p>
    </div>
  )
}

function recognize(raw: string): RecognizedCommandPreview | null {
  const text = raw.toLowerCase()
  const commands: [RegExp, CopilotToolKind, string][] = [
    [/email|commercial/, 'send_email', 'Kavya Menon'],
    [/whatsapp|reply|counter-script/, 'send_whatsapp', 'Anjali Ramesh'],
    [/follow.?up|callback/, 'schedule_follow_up', 'Rahul Das'],
    [/book|meeting|visit/, 'create_booking', 'Mumbai Clinic'],
    [/quote|quotation/, 'draft_quotation', 'Mumbai Clinic'],
    [/stage|move/, 'update_stage', 'Mumbai Clinic'],
    [/note|fact/, 'add_note', 'Anjali Ramesh'],
    [/assign|todo/, 'assign_todo', 'Nikhil S.'],
  ]
  const match = commands.find(([pattern]) => pattern.test(text))
  if (!match) return null
  return { raw, intent: match[1], entity: { type: 'lead', id: 'preview-lead', label: match[2] }, parameters: { timing: text.includes('tomorrow') ? 'Tomorrow' : 'Now' }, requiresApproval: true, sample: true }
}

export function AgentPanel({ anchorName = 'Anjali Ramesh', anchorDetail = 'NEET repeater · WhatsApp' }) {
  const [thread, setThread] = useState<AgentMsg[]>([])
  const [playing, setPlaying] = useState(false)
  const [input, setInput] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [autonomy, setAutonomy] = useState<'suggest_only' | 'approve_each' | 'safe_auto'>('approve_each')
  const endRef = useRef<HTMLDivElement>(null)
  const recognized = input.trim() ? recognize(input) : null

  // Mock engine: any submission replays the scripted exchange progressively.
  const run = (text: string) => {
    if (playing) return
    setPlaying(true)
    setInput('')
    const script: AgentMsg[] = [
      { id: `u-${Date.now()}`, role: 'user', text },
      ...MOCK_AGENT_THREAD.slice(1),
    ]
    script.forEach((m, i) => {
      setTimeout(() => {
        setThread((t) => [...t, m])
        if (i === script.length - 1) setPlaying(false)
      }, i * 650)
    })
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [thread.length])

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* Anchor + honesty tag */}
      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent shadow-elev-1">
            <Bot aria-hidden size={19} />
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-pill border-2 border-surface bg-success" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h2 className="text-md font-semibold tracking-[-0.02em] text-fg">Sales copilot</h2><SampleTag label="Preview" /></div>
            <p className="mt-0.5 text-2xs text-fg-muted">Prepares work, shows its plan, and acts within your policy.</p>
          </div>
          <button onClick={() => setAutonomy((mode) => mode === 'suggest_only' ? 'approve_each' : mode === 'approve_each' ? 'safe_auto' : 'suggest_only')} className="inline-flex min-h-8 items-center gap-1 rounded-pill border border-success/25 bg-success-subtle px-2 text-2xs font-semibold text-success" aria-label={`Copilot autonomy: ${autonomy.replaceAll('_', ' ')}`} title="Preview autonomy dial"><ShieldCheck aria-hidden size={13} />{autonomy === 'suggest_only' ? 'Suggest only' : autonomy === 'approve_each' ? 'Approve each' : 'Safe auto'}</button>
        </div>
        <div className="mt-3"><AnchorChip name={anchorName} detail={anchorDetail} /></div>
      </div>

      <div className="app-grid min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {thread.length === 0 ? (
          <>
            <div className="rounded-xl border border-border bg-[linear-gradient(145deg,var(--surface-raised),var(--accent-subtle))] p-4 shadow-elev-1">
              <WandSparkles aria-hidden size={20} className="text-accent" />
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.025em] text-fg">I found work worth moving.</h3>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">Each action shows the target, approval boundary, execution state and undo window.</p>
            </div>
            <section aria-labelledby="copilot-actions"><div className="mb-2 flex items-center justify-between"><h3 id="copilot-actions" className="label-caps">Proposed work</h3><span className="text-2xs text-fg-subtle">{COPILOT_ACTIONS.filter((action) => action.state === 'proposed').length} waiting</span></div><div className="space-y-2">{COPILOT_ACTIONS.slice(0, showAll ? COPILOT_ACTIONS.length : 3).map((action) => <CopilotToolCard key={action.id} action={action} />)}</div><button onClick={() => setShowAll((value) => !value)} className="mt-2 flex min-h-9 w-full items-center justify-center gap-1 text-2xs font-semibold text-fg-muted hover:text-fg">{showAll ? 'Show fewer actions' : `Show all ${COPILOT_ACTIONS.length} tool actions`}<ChevronDown aria-hidden size={12} className={showAll ? 'rotate-180' : ''} /></button></section>
            <div className="grid gap-2">
              {AGENT_STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => run(s)}
                  className="group flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-xs font-medium text-fg shadow-elev-1 hover:border-border-strong hover:bg-surface-raised"
                >
                  <Sparkles aria-hidden size={13} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">{s}</span>
                  <Command aria-hidden size={13} className="text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-surface p-3 shadow-elev-1">
              <h3 className="label-caps mb-1.5">Recent agent activity</h3>
              {MOCK_AGENT_ACTIVITY.map((a) => (
                <div key={a.id} className="flex gap-2 border-b border-border py-2 last:border-0">
                  <CheckCircle2 aria-hidden size={13} className="mt-0.5 shrink-0 text-success" />
                  <p className="text-xs leading-relaxed text-fg-muted">{a.text}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          thread.map((m) => <Msg key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Composer: text + push-to-talk land in the SAME lane */}
      <div className="border-t border-border bg-surface-glass p-3 backdrop-blur-xl">
        {input.trim() && <div className={['mb-2 rounded-lg border p-2.5', recognized ? 'border-accent/25 bg-accent-subtle' : 'border-border bg-surface-sunk'].join(' ')}>{recognized ? <><div className="flex items-center gap-1.5 text-2xs font-semibold text-accent"><Command aria-hidden size={12} /> Recognized command · Preview</div><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-pill bg-surface px-2 py-1 text-2xs font-semibold text-fg">{recognized.intent.replaceAll('_', ' ')}</span><span className="rounded-pill bg-surface px-2 py-1 text-2xs font-semibold text-fg">{recognized.entity.label}</span><span className="rounded-pill bg-surface px-2 py-1 text-2xs font-semibold text-success">Approval required</span></div></> : <div className="flex items-center gap-1.5 text-2xs text-fg-muted"><Sparkles aria-hidden size={12} /> Free chat · no tool action detected</div>}</div>}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim()) run(input.trim())
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent…"
            aria-label="Ask the agent"
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-3 text-sm text-fg shadow-[var(--inset-highlight)] placeholder:text-fg-subtle hover:border-border-strong"
          />
          <VoiceButton onTranscript={(t) => run(t)} />
          <Button type="submit" size="sm" className="h-10" disabled={playing} aria-label="Send">
            <SendHorizontal aria-hidden size={16} />
          </Button>
        </form>
      </div>
    </div>
  )
}
