import { useEffect, useRef, useState } from 'react'
import { Mic, X } from 'lucide-react'
import { Button } from '../Button'
import { useClient } from '../../shell/ClientProvider'
import { transcribeNote } from '../../lib/api'

// Push-to-talk, wired to POST /api/transcribe (S2-E2). The state machine is
// unchanged from the Wave-3F preview — ready → listening → processing →
// transcript (editable; low confidence flagged) → confirm/cancel — but every
// state is now driven by a real recording and a real response instead of
// timers, and there is no seeded transcript to mistake for one.
//
// Voice lands in the SAME approval cards as typed input: this component only
// ever hands text to `onTranscript`. It never sends anything itself.

type VoiceState = 'ready' | 'listening' | 'processing' | 'transcript'

/** Every failure in the rep's words — never a status code or a route name.
 *  `budget_exceeded` is deliberately NOT softened into a retry: the wall is
 *  hard, and typing is the honest fallback (no cheaper model is substituted). */
function explain(kind: string): string {
  switch (kind) {
    case 'budget_exceeded':
      return 'Voice budget reached for this month. Type the note instead.'
    case 'no_key':
      return 'Paste your workspace access key in the composer first.'
    case 'no_session':
    case 'unauthorized':
      return 'Your session expired. Sign in again, then retry.'
    case 'forbidden':
      return "Voice notes aren't enabled for your role."
    case 'paused':
    case 'unavailable':
      return 'Voice is unavailable right now. Type the note instead.'
    case 'network':
      return 'Voice could not reach the server. Check your connection and retry.'
    default:
      return 'That recording could not be turned into text. Try again, or type it.'
  }
}

export function VoiceButton({
  onTranscript,
  compact = false,
}: {
  onTranscript?: (text: string) => void
  /** Icon-sized idle state for the conversation composer. */
  compact?: boolean
}) {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const [state, setState] = useState<VoiceState>('ready')
  const [text, setText] = useState('')
  const [lowConfidence, setLowConfidence] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])

  const stopTracks = () => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    recorder.current = null
  }
  // A recording left running after the composer unmounts holds the mic open and
  // keeps the browser's recording indicator lit on a screen that is gone.
  useEffect(() => stopTracks, [])

  async function process(audio: Blob) {
    if (!clientId) {
      setState('ready')
      setError('Pick a workspace before recording a note.')
      return
    }
    setState('processing')
    const result = await transcribeNote(audio, clientId)
    if (result.kind !== 'ok') {
      setState('ready')
      setError(explain(result.kind))
      return
    }
    if (!result.data.ok) {
      setState('ready')
      setError(explain(result.data.error))
      return
    }
    setText(result.data.transcript)
    // The provider's own signal, not a guess made here. `degraded` means a
    // fallback path produced the text, so the wording is worth a second look.
    setLowConfidence(result.data.degraded)
    setState('transcript')
  }

  async function start() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not available in this browser.')
      return
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone permission was not granted. Allow it for this site and retry.')
      return
    }
    const next = new MediaRecorder(stream.current)
    chunks.current = []
    next.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data)
    }
    next.onstop = () => {
      const audio = new Blob(chunks.current, { type: next.mimeType || 'audio/webm' })
      stopTracks()
      void process(audio)
    }
    recorder.current = next
    next.start()
    setState('listening')
  }

  const stop = () => {
    // onstop moves the machine to `processing`; stopping the tracks here
    // instead would drop the audio on the floor.
    recorder.current?.stop()
  }

  // Compact is the in-row form (composer, call bar, objection sheet): the row is
  // `items-end` and fixed-height, so the transcript card and any error float
  // ABOVE the button instead of growing the row and shoving Send out of line.
  const shell = compact ? 'relative inline-block' : 'inline-flex flex-col items-start gap-1'
  const overlay = compact ? 'absolute right-0 bottom-full z-10 mb-2 w-72' : ''

  if (state === 'transcript') {
    return (
      <div className={shell}>
      <div className={['rounded-md border border-border bg-surface p-2.5 shadow-elev-2', overlay].join(' ')} role="group" aria-label="Voice transcript">
        <div className="flex items-center justify-between gap-2">
          <span className="label-caps">Transcript</span>
          {lowConfidence && (
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
            lowConfidence ? 'border-warn' : 'border-border',
          ].join(' ')}
        />
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              onTranscript?.(text)
              setState('ready')
              setText('')
            }}
          >
            Use this
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setState('ready'); setText('') }}>
            Cancel
          </Button>
        </div>
      </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      <button
        onClick={() => (state === 'ready' ? void start() : stop())}
        disabled={state === 'processing'}
        aria-label={
          state === 'ready' ? 'Push to talk' : state === 'listening' ? 'Listening — press to stop' : 'Processing'
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
      {error && (
        <p role="alert" className={['text-2xs font-medium text-danger', compact ? `${overlay} rounded-md border border-danger/25 bg-danger-subtle px-2 py-1.5 shadow-elev-2` : ''].join(' ')}>
          {error}
        </p>
      )}
    </div>
  )
}
