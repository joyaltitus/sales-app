import { useRef, useState } from 'react'
import { Button } from '../../src/ui/Button'
import type { ChecklistItem } from '../../src/lib/agent-chat'
import {
  approvalsWithEdits,
  approveChecklist,
  proposedFields,
  proposeVoiceNote,
  transcribeNote,
} from '../lib/voice-flow'
import { VoiceCard } from './VoiceCard'

type Props = { clientId: string; leadId: string; onSaved?: () => void }

function failure(kind: string): string {
  if (kind === 'no_key') return 'Add the hub gateway key in Settings before using voice.'
  if (kind === 'no_session' || kind === 'unauthorized') return 'Sign in again to use voice.'
  if (kind === 'network') return 'Voice could not reach the server. Check your connection and retry.'
  return 'Voice could not be processed. You can retry or type the note.'
}

export function VoiceFlow({ clientId, leadId, onSaved }: Props) {
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [typedNote, setTypedNote] = useState('')
  const [saved, setSaved] = useState(false)

  async function propose(text: string) {
    setBusy(true)
    setError(null)
    const result = await proposeVoiceNote({ transcript: text, clientId, leadId })
    setBusy(false)
    if (result.kind === 'budget_exceeded') {
      setTyping(true)
      setError('Voice budget reached. Type the note instead \u2014 no lower-quality model will be used.')
      return
    }
    if (result.kind !== 'ok' || !result.data.ok) {
      setError(result.kind === 'ok' ? 'No safe CRM proposal was produced. Edit the note and retry.' : failure(result.kind))
      return
    }
    if (proposedFields(result.data.checklist).length === 0) {
      setError('No editable CRM fields were proposed. Rephrase the note or discard it.')
      return
    }
    setTyping(false)
    setTypedNote('')
    setTranscript(text)
    setChecklist(result.data.checklist)
    setSessionId(result.data.session_id)
  }

  async function processAudio(audio: Blob) {
    setBusy(true)
    const result = await transcribeNote(audio, clientId)
    setBusy(false)
    if (result.kind === 'budget_exceeded') {
      setTyping(true)
      setError('Voice budget reached. Type the note instead — no lower-quality model will be used.')
      return
    }
    if (result.kind !== 'ok' || !result.data.ok) {
      setError(failure(result.kind))
      return
    }
    await propose(result.data.transcript)
  }

  async function onRecordPress() {
    if (recording) {
      recorder.current?.stop()
      return
    }
    setError(null)
    setSaved(false)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is unavailable in this browser.')
      return
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const next = new MediaRecorder(stream.current)
      chunks.current = []
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data)
      }
      next.onstop = () => {
        const audio = new Blob(chunks.current, { type: next.mimeType || 'audio/webm' })
        stream.current?.getTracks().forEach((track) => track.stop())
        stream.current = null
        recorder.current = null
        setRecording(false)
        void processAudio(audio)
      }
      recorder.current = next
      next.start()
      setRecording(true)
    } catch {
      setError('Microphone permission was not granted. Allow it for this panel and retry.')
    }
  }

  async function approve(draft: Record<string, string>) {
    if (!sessionId) return
    setBusy(true)
    setError(null)
    const result = await approveChecklist(sessionId, clientId, approvalsWithEdits(checklist, draft))
    setBusy(false)
    if (result.kind !== 'ok' || !result.data.ok) {
      setError(result.kind === 'ok' ? 'This proposal is no longer available. Record or type it again.' : failure(result.kind))
      return
    }
    setSaved(true)
    setChecklist([])
    setSessionId(null)
    onSaved?.()
  }

  function discard() {
    setChecklist([])
    setSessionId(null)
    setTranscript(null)
    setSaved(false)
    setError(null)
  }

  return (
    <div className="space-y-2">
      <VoiceCard
        recording={recording}
        transcribing={busy}
        transcript={transcript}
        proposedFields={proposedFields(checklist)}
        onRecordPress={() => void onRecordPress()}
        onApprove={(draft) => void approve(draft)}
        onDiscard={discard}
      />
      {error && <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{error}</p>}
      {saved && <p role="status" className="rounded-md bg-success-subtle px-3 py-2 text-xs text-success">Approved CRM fields saved.</p>}
      {typing && (
        <form
          className="space-y-2 rounded-lg border border-border bg-surface-raised p-3"
          onSubmit={(event) => { event.preventDefault(); void propose(typedNote.trim()) }}
        >
          <label className="block text-xs font-semibold text-fg">
            Type note instead
            <textarea
              required
              rows={3}
              value={typedNote}
              onChange={(event) => setTypedNote(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" className="min-h-10 w-full" disabled={busy || !typedNote.trim()}>Propose fields</Button>
        </form>
      )}
    </div>
  )
}
