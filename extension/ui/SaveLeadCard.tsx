import { useEffect, useState } from 'react'
import { MessageCircle, UserPlus } from 'lucide-react'
import type { OpenChat } from '../lib/wa-chat'
import { CHANNELS, VALUE_PRESETS, hasDialableDigits, withPhonePrefix } from '@app/lib/lead-fields'
import { Button } from '../../src/ui/Button'
import { Input } from '../../src/ui/Input'

export type SaveLeadDraft = {
  name: string
  phone: string
  channel: string
  estValue: number | null
  nextAction: string
  note: string
  stageId: string
}

type Props = {
  /** The followed chat, when this card is answering one. Null = manual entry from the CRM. */
  chat: OpenChat | null
  stages: { id: string; label: string }[]
  stagesLoading?: boolean
  busy?: boolean
  message?: string | null
  /** Seed for manual entry — whatever the rep had typed in the CRM search box. */
  initialQuery?: string
  title?: string
  hint?: string
  /** Offered only when WhatsApp Web has a one-to-one chat open. */
  openChat?: OpenChat | null
  onSave: (draft: SaveLeadDraft) => void
  onDismiss?: () => void
}

const selectClass =
  'min-h-11 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg disabled:text-fg-subtle'

/** A bare number typed into search should land in Phone, a name in Name. */
function seedFrom(query: string): { name: string; phone: string } {
  const trimmed = query.trim()
  if (!trimmed) return { name: '', phone: '' }
  return /\p{L}/u.test(trimmed) ? { name: trimmed, phone: '' } : { name: '', phone: trimmed }
}

/**
 * A chat display name is the contact's name when saved, the number itself
 * when not. Route it through the same split so a numeric header fills phone
 * only and leaves name empty.
 */
function seedFromChat(chat: OpenChat): { name: string; phone: string } {
  const split = seedFrom(chat.displayName)
  if (split.name) return { name: chat.displayName, phone: chat.phoneE164 ?? '' }
  return { name: '', phone: chat.phoneE164 ?? split.phone }
}

function Field({ label, required, children }: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-fg-muted">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </span>
      {children}
    </label>
  )
}

/**
 * The extension's new-lead form — the same fields as the web AddLeadModal, in a
 * 400px column, and writing through the same create_manual_lead RPC.
 */
export function SaveLeadCard({
  chat, stages, stagesLoading, busy, message,
  initialQuery, title, hint, openChat, onSave, onDismiss,
}: Props) {
  const seed = chat ? seedFromChat(chat) : seedFrom(initialQuery ?? '')
  const [name, setName] = useState(seed.name)
  const [phone, setPhone] = useState(withPhonePrefix(seed.phone))
  const [channel, setChannel] = useState(chat ? 'whatsapp' : 'phone')
  const [estValue, setEstValue] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [note, setNote] = useState('')
  const [stageId, setStageId] = useState('')

  // Manual entry re-seeds when the rep changes their search and reopens the
  // form; the chat-answering card must NOT, or a header repaint would wipe an
  // edit the rep was halfway through.
  useEffect(() => {
    if (chat) return
    const next = seedFrom(initialQuery ?? '')
    setName(next.name)
    setPhone(withPhonePrefix(next.phone))
  }, [chat, initialQuery])

  const chosenStage = stageId || stages[0]?.id || ''
  const canSave = !!hasDialableDigits(phone) && !!chosenStage && !busy

  return (
    <section className="rounded-lg border border-border bg-surface-raised p-3 shadow-elev-1">
      <div className="flex items-center gap-2">
        <UserPlus aria-hidden size={15} strokeWidth={1.9} className="shrink-0 text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{title ?? 'Not in your CRM yet'}</h2>
        {onDismiss && (
          <Button variant="ghost" size="sm" className="min-h-11" onClick={onDismiss}>
            Not now
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">
        {hint ?? 'This chat isn’t linked to a lead. Check the details, then save them.'}
      </p>

      {/* Manual entry, with WhatsApp Web open on somebody: one tap copies that
          chat's name and number in. The name only lands when the number is
          SAVED in the rep's phone — otherwise WhatsApp's header is the number
          itself, and parseChat gives us that as the display name. */}
      {!chat && openChat && (
        <Button
          variant="secondary"
          className="mt-2 min-h-11 w-full"
          onClick={() => {
            const next = seedFromChat(openChat)
            setName(next.name)
            setPhone(withPhonePrefix(next.phone))
            setChannel('whatsapp')
          }}
        >
          <MessageCircle aria-hidden size={15} strokeWidth={1.9} />
          Use open chat — {openChat.displayName}
        </Button>
      )}

      <div className="mt-3 grid gap-2.5">
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" placeholder="e.g. Rahul Sharma" className="min-h-11" />
        </Field>

        <Field label="Phone" required>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            autoComplete="off"
            placeholder="+91 98765 43210"
            className="min-h-11"
          />
        </Field>

        <Field label="Source" required>
          <select value={channel} onChange={(event) => setChannel(event.target.value)} className={selectClass}>
            {CHANNELS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Stage" required>
          <select
            value={chosenStage}
            disabled={stagesLoading || stages.length === 0}
            onChange={(event) => setStageId(event.target.value)}
            className={selectClass}
          >
            {stages.length === 0 && <option value="">{stagesLoading ? 'Loading stages…' : 'No stages set up'}</option>}
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.label}</option>
            ))}
          </select>
        </Field>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-fg-muted">Estimated value</span>
          {/* Their own row: sharing a line with the label squeezed both, and the
              last preset fell off the edge of a 400px panel. */}
          <div className="no-scrollbar flex gap-1 overflow-x-auto pb-0.5">
            {VALUE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setEstValue(String(preset.value))}
                className="min-h-11 shrink-0 rounded-md border border-border bg-surface px-2 text-2xs font-semibold text-fg-muted transition-colors hover:border-accent hover:text-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Input
            value={estValue}
            onChange={(event) => setEstValue(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="₹60K"
            aria-label="Estimated value"
            className="min-h-11"
          />
        </div>

        <Field label="Next action">
          <Input
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            autoComplete="off"
            placeholder="e.g. Send the fee structure"
            className="min-h-11"
          />
        </Field>

        <Field label="Note">
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What they asked for"
            className="w-full resize-none rounded-md border border-border bg-surface p-2.5 text-sm text-fg placeholder:text-fg-subtle"
          />
        </Field>
      </div>

      {/* Rule 3 in the interface: the rep reads the exact row before it exists. */}
      <dl aria-label="What will be saved" className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-surface-sunk px-3 py-2 text-2xs">
        <dt className="text-fg-subtle">Saves as</dt>
        <dd className="min-w-0 truncate text-fg-muted">{name.trim() || '—'}</dd>
        <dt className="text-fg-subtle">Number</dt>
        <dd className="min-w-0 truncate text-fg-muted tnum">{hasDialableDigits(phone) ? phone.trim() : '—'}</dd>
        <dt className="text-fg-subtle">Source</dt>
        <dd className="text-fg-muted">{CHANNELS.find((item) => item.value === channel)?.label ?? channel}</dd>
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
        onClick={() => {
          const parsed = Number(estValue.replace(/[^0-9.]/g, ''))
          onSave({
            name: name.trim(),
            phone: phone.trim(),
            channel,
            estValue: estValue.trim() && Number.isFinite(parsed) ? parsed : null,
            nextAction: nextAction.trim(),
            note: note.trim(),
            stageId: chosenStage,
          })
        }}
      >
        Save to CRM
      </Button>
    </section>
  )
}
