import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { OpenChat } from '../lib/wa-chat'
import { Button } from '../../src/ui/Button'
import { Input } from '../../src/ui/Input'

export type SaveLeadDraft = {
  name: string
  phone: string
  interest: string
  stageId: string
}

type Props = {
  chat: OpenChat
  stages: { id: string; label: string }[]
  stagesLoading?: boolean
  busy?: boolean
  message?: string | null
  onSave: (draft: SaveLeadDraft) => void
  onDismiss?: () => void
}

/**
 * Save-as-lead for a chat that matched nothing in the book.
 *
 * The rep is the accountable party for what lands in the CRM, so this card
 * shows every field it will write, pre-filled from the chat header and fully
 * editable, and writes nothing until "Save to CRM" is clicked. Nothing is
 * captured in the background; a rep who ignores this card leaves no trace of
 * that conversation in the database.
 */
export function SaveLeadCard({ chat, stages, stagesLoading, busy, message, onSave, onDismiss }: Props) {
  const [name, setName] = useState(chat.displayName)
  const [phone, setPhone] = useState(chat.phoneE164 ?? '')
  const [interest, setInterest] = useState('')
  const [stageId, setStageId] = useState('')

  const chosenStage = stageId || stages[0]?.id || ''
  const canSave = !!name.trim() && !!phone.trim() && !!chosenStage && !busy

  return (
    <section className="rounded-lg border border-border bg-surface-raised p-3 shadow-elev-1">
      <div className="flex items-center gap-2">
        <UserPlus aria-hidden size={15} strokeWidth={1.9} className="shrink-0 text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">Not in your CRM yet</h2>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Not now
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">
        This chat isn’t linked to a lead. Check the details, then save them.
      </p>

      <div className="mt-3 grid gap-2.5">
        <label className="grid gap-1">
          <span className="label-caps">Name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </label>
        <label className="grid gap-1">
          <span className="label-caps">Phone</span>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="off"
            placeholder="+91…"
          />
        </label>
        <label className="grid gap-1">
          <span className="label-caps">Course or interest</span>
          <Input
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            placeholder="Optional"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1">
          <span className="label-caps">Stage</span>
          <select
            value={chosenStage}
            disabled={stagesLoading || stages.length === 0}
            onChange={(event) => setStageId(event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg disabled:text-fg-subtle"
          >
            {stages.length === 0 && <option value="">{stagesLoading ? 'Loading stages…' : 'No stages set up'}</option>}
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Rule 3 in the interface: the rep reads the exact row before it exists. */}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-surface-sunk px-3 py-2 text-2xs">
        <dt className="text-fg-subtle">Saves as</dt>
        <dd className="min-w-0 truncate text-fg-muted">{name.trim() || '—'}</dd>
        <dt className="text-fg-subtle">Number</dt>
        <dd className="min-w-0 truncate text-fg-muted tnum">{phone.trim() || '—'}</dd>
        <dt className="text-fg-subtle">Source</dt>
        <dd className="text-fg-muted">WhatsApp (personal)</dd>
      </dl>

      {message && (
        <p role="status" className="mt-2 rounded-md border border-border bg-surface-sunk px-3 py-2 text-xs text-fg-muted">
          {message}
        </p>
      )}

      <Button
        className="mt-3 min-h-11 w-full"
        loading={busy}
        disabled={!canSave}
        onClick={() => onSave({ name: name.trim(), phone: phone.trim(), interest: interest.trim(), stageId: chosenStage })}
      >
        Save to CRM
      </Button>
    </section>
  )
}
