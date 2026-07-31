import { useEffect, useRef, useState } from 'react'
import { SendHorizontal, Sparkles } from 'lucide-react'
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
          'max-w-[88%] rounded-md px-3 py-2 text-sm break-words',
          user ? 'bg-accent-subtle text-fg' : 'border border-border bg-surface text-fg',
        ].join(' ')}
      >
        {m.text}
      </p>
    </div>
  )
}

export function AgentPanel({ anchorName = 'Anjali Ramesh', anchorDetail = 'NEET repeater · WhatsApp' }) {
  const [thread, setThread] = useState<AgentMsg[]>([])
  const [playing, setPlaying] = useState(false)
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

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
    <div className="flex h-full min-h-0 flex-col">
      {/* Anchor + honesty tag */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <AnchorChip name={anchorName} detail={anchorDetail} />
        <SampleTag label="Preview — not wired" />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {thread.length === 0 ? (
          <>
            <p className="pt-2 text-sm text-fg-muted">
              Ask about this customer, or start with one of these:
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {AGENT_STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => run(s)}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-left text-xs text-fg hover:border-border-strong hover:bg-surface-sunk"
                >
                  <Sparkles aria-hidden size={11} className="mr-1.5 inline text-accent" />
                  {s}
                </button>
              ))}
            </div>

            <div className="pt-3">
              <h3 className="label-caps mb-1.5">Recent agent activity</h3>
              {MOCK_AGENT_ACTIVITY.map((a) => (
                <p key={a.id} className="border-b border-border py-1.5 text-xs text-fg-muted last:border-0">
                  {a.text}
                </p>
              ))}
            </div>
          </>
        ) : (
          thread.map((m) => <Msg key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Composer: text + push-to-talk land in the SAME lane */}
      <div className="border-t border-border p-3">
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
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong"
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
