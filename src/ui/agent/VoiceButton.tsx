import { useEffect, useRef, useState } from 'react'
import { Mic, X } from 'lucide-react'
import { Button } from '../Button'

// Push-to-talk, UI states only (no transcription wired — Wave-3F). The state
// machine is the deliverable: ready → listening → processing → transcript
// (editable; low-confidence flagged) → confirm/cancel. Voice lands in the SAME
// approval cards as typed input — no separate voice pathway.

type VoiceState = 'ready' | 'listening' | 'processing' | 'transcript'

const DEMO_TRANSCRIPT = 'Book a campus visit for Anjali on Saturday morning'

export function VoiceButton({
  lowConfidenceDemo = false,
  onTranscript,
  compact = false,
}: {
  /** Preview hook: render the low-confidence treatment. */
  lowConfidenceDemo?: boolean
  onTranscript?: (text: string) => void
  /** Icon-sized idle state for the conversation composer. */
  compact?: boolean
}) {
  const [state, setState] = useState<VoiceState>('ready')
  const [text, setText] = useState(DEMO_TRANSCRIPT)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
  }

  useEffect(() => clearTimers, [])

  const start = () => {
    clearTimers()
    setState('listening')
    // Mock timing: listening 1.2s → processing 0.9s → transcript
    timers.current = [
      window.setTimeout(() => setState('processing'), 1200),
      window.setTimeout(() => setState('transcript'), 2100),
    ]
  }

  const cancel = () => {
    clearTimers()
    setState('ready')
  }

  if (state === 'transcript') {
    return (
      <div className="rounded-md border border-border bg-surface p-2.5" role="group" aria-label="Voice transcript">
        <div className="flex items-center justify-between gap-2">
          <span className="label-caps">Transcript</span>
          {lowConfidenceDemo && (
            <span className="text-2xs font-medium text-warn">Low confidence — check wording</span>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          aria-label="Edit transcript"
          className={[
            'mt-1.5 w-full resize-none rounded-sm border bg-surface-sunk px-2 py-1.5 text-sm text-fg',
            lowConfidenceDemo ? 'border-warn' : 'border-border',
          ].join(' ')}
        />
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              onTranscript?.(text)
              setState('ready')
            }}
          >
            Use this
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setState('ready')}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={state === 'ready' ? start : cancel}
      aria-label={
        state === 'ready' ? 'Push to talk' : state === 'listening' ? 'Listening — release to stop' : 'Processing'
      }
      className={[
        'inline-flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors select-none',
        compact ? 'w-10 px-0' : 'px-3.5',
        state === 'ready' && 'border-border-strong bg-surface text-fg hover:bg-surface-sunk',
        state === 'listening' && 'border-danger bg-danger-subtle text-danger',
        state === 'processing' && 'border-border bg-surface-sunk text-fg-muted',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {state === 'listening' ? (
        <>
          <span className="flex h-4 items-end gap-0.5" aria-hidden>
            {[8, 14, 10, 16, 7].map((height, i) => (
              <span key={i} className="w-0.5 animate-pulse rounded-pill bg-current" style={{ height, animationDelay: `${i * 80}ms` }} />
            ))}
          </span>
          {!compact && <>Listening <X aria-hidden size={13} /></>}
        </>
      ) : state === 'processing' ? (
        <>
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent"
          />
          {!compact && 'Processing'}
        </>
      ) : (
        <>
          <Mic aria-hidden size={15} />
          {!compact && 'Talk'}
        </>
      )}
    </button>
  )
}
