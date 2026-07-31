import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
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
}: {
  /** Preview hook: render the low-confidence treatment. */
  lowConfidenceDemo?: boolean
  onTranscript?: (text: string) => void
}) {
  const [state, setState] = useState<VoiceState>('ready')
  const [text, setText] = useState(DEMO_TRANSCRIPT)

  const start = () => {
    setState('listening')
    // Mock timing: listening 1.2s → processing 0.9s → transcript
    setTimeout(() => setState('processing'), 1200)
    setTimeout(() => setState('transcript'), 2100)
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
      onClick={state === 'ready' ? start : undefined}
      aria-label={
        state === 'ready' ? 'Push to talk' : state === 'listening' ? 'Listening — release to stop' : 'Processing'
      }
      className={[
        'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors select-none',
        state === 'ready' && 'border-border-strong bg-surface text-fg hover:bg-surface-sunk',
        state === 'listening' && 'border-danger bg-danger-subtle text-danger',
        state === 'processing' && 'border-border bg-surface-sunk text-fg-muted',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {state === 'listening' ? (
        <>
          <Square aria-hidden size={14} className="animate-pulse" />
          Listening…
        </>
      ) : state === 'processing' ? (
        <>
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent"
          />
          Processing
        </>
      ) : (
        <>
          <Mic aria-hidden size={15} />
          Talk
        </>
      )}
    </button>
  )
}
