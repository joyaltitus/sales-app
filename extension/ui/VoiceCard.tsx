import { useEffect, useState } from 'react'
import { Check, Mic, Square } from 'lucide-react'
import { Button } from '../../src/ui/Button'
import { Input } from '../../src/ui/Input'

export type ProposedField = { key: string; label: string; value: string }

type Props = {
  recording?: boolean
  transcribing?: boolean
  transcript?: string | null
  proposedFields: ProposedField[]
  onRecordPress?: () => void
  onApprove: (fields: Record<string, string>) => void
  onDiscard: () => void
}

const fieldsSignature = (fields: ProposedField[]) => fields.map((f) => `${f.key}:${f.value}`).join('|')

export function VoiceCard({
  recording = false,
  transcribing = false,
  transcript,
  proposedFields,
  onRecordPress,
  onApprove,
  onDiscard,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(proposedFields.map((field) => [field.key, field.value])),
  )

  const signature = fieldsSignature(proposedFields)
  useEffect(() => {
    setDraft(Object.fromEntries(proposedFields.map((field) => [field.key, field.value])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const hasContent = Boolean(transcript) || proposedFields.length > 0

  return (
    <section aria-label="Voice capture" className="space-y-3 rounded-lg border border-border bg-surface-raised p-3 shadow-elev-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRecordPress}
          disabled={transcribing}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          aria-pressed={recording}
          className={[
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors select-none disabled:opacity-60',
            recording
              ? 'border-danger bg-danger-subtle text-danger'
              : 'border-border-strong bg-surface text-fg hover:bg-surface-sunk',
          ].join(' ')}
        >
          {recording ? <Square aria-hidden size={16} /> : <Mic aria-hidden size={20} strokeWidth={1.75} />}
        </button>
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-fg">{recording ? 'Recording…' : transcribing ? 'Transcribing…' : 'Talk to log'}</span>
          <p className="text-2xs leading-snug text-fg-muted">Describe the call. You review the draft before anything is saved.</p>
        </div>
        {recording && (
          <span className="flex h-4 shrink-0 items-end gap-0.5" aria-hidden>
            {[8, 14, 10, 16, 7].map((height, i) => (
              <span key={i} className="w-0.5 animate-pulse rounded-pill bg-current text-danger" style={{ height, animationDelay: `${i * 80}ms` }} />
            ))}
          </span>
        )}
      </div>

      {transcript && (
        <blockquote className="rounded-md border border-border bg-surface-sunk px-3 py-2 text-xs leading-relaxed text-fg-muted">
          “{transcript}”
        </blockquote>
      )}

      {proposedFields.length > 0 && (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-fg-muted">Proposed fields</span>
          {proposedFields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-0.5 block text-2xs font-medium text-fg-muted">{field.label}</span>
              <Input
                value={draft[field.key] ?? ''}
                disabled={transcribing}
                onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                aria-label={`Proposed ${field.label}`}
                className="h-9"
              />
            </label>
          ))}
        </div>
      )}

      {hasContent && (
        <div className="flex gap-2">
          <Button className="min-h-11 flex-1" disabled={transcribing} onClick={() => onApprove(draft)}>
            <Check aria-hidden size={16} strokeWidth={2.2} />
            Approve
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      )}
    </section>
  )
}
