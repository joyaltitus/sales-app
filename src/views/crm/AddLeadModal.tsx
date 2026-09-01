import { useEffect, useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import type { LeadStage } from '../../lib/leads-data'
import { createLead } from '../../lib/crm-actions'
import { useAuth } from '../../auth/AuthProvider'
import { formatPhone } from '../../lib/phone'
import { CHANNELS, VALUE_PRESETS } from '../../lib/lead-fields'
import { Button } from '../../ui/Button'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (leadId: string) => void
  clientId: string
  stages: LeadStage[]
  defaultStageId?: string
}

export function AddLeadModal({
  open,
  onClose,
  onCreated,
  clientId,
  stages,
  defaultStageId,
}: Props) {
  const { session } = useAuth()
  const initialStage = defaultStageId || stages[0]?.id || ''

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<string>('phone')
  const [stageId, setStageId] = useState(initialStage)
  const [estValue, setEstValue] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setPhone('')
      setChannel('phone')
      setStageId(defaultStageId || stages[0]?.id || '')
      setEstValue('')
      setNextAction('')
      setNote('')
      setError(null)
      setBusy(false)
    }
  }, [open, defaultStageId, stages])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const phonePreview = phone.trim() ? formatPhone(phone.trim()) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) {
      setError('Please enter a phone number or contact identifier.')
      return
    }
    if (!stageId) {
      setError('Please select an initial pipeline stage.')
      return
    }

    setBusy(true)
    setError(null)

    const parsedVal = estValue.trim() ? Number(estValue.replace(/[^0-9.]/g, '')) : null

    const res = await createLead(clientId, {
      profileName: name.trim(),
      phone: phone.trim(),
      channel,
      stageId,
      estValue: Number.isFinite(parsedVal) ? parsedVal : null,
      nextAction: nextAction.trim() || null,
      note: note.trim() || null,
      authorEmail: session?.user?.email ?? null,
    })

    setBusy(false)

    if (res.ok && res.leadId) {
      onCreated(res.leadId)
      onClose()
    } else {
      setError(!res.ok && res.message ? res.message : 'Failed to create lead. Please check your inputs and permissions.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-lead-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        className="fixed inset-0 bg-[var(--overlay)] transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-elev-3 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <UserPlus aria-hidden size={18} />
            </div>
            <div>
              <h2 id="add-lead-title" className="text-md font-semibold text-fg">
                Add Lead
              </h2>
              <p className="text-xs text-fg-muted">
                Create a new customer or inbound referral directly in your pipeline.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-sunk hover:text-fg"
          >
            <X aria-hidden size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-danger-subtle p-3 text-xs text-danger">
              {error}
            </div>
          )}

          {/* Contact Details (2 columns) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-2xs font-semibold text-fg-subtle uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-fg-subtle uppercase tracking-wider">
                Phone Number <span className="text-danger">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 98765 43210"
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-accent"
                />
              </div>
              {phonePreview && phonePreview !== phone && (
                <p className="mt-1 text-3xs text-fg-muted">
                  Formatted: <span className="font-mono text-fg">{phonePreview}</span>
                </p>
              )}
            </div>
          </div>

          {/* Channel & Stage (2 columns) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-2xs font-semibold text-fg-subtle uppercase tracking-wider">
                Source Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg hover:border-border-strong focus:border-accent"
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-2xs font-semibold text-fg-subtle uppercase tracking-wider">
                Pipeline Stage <span className="text-danger">*</span>
              </label>
              <select
                required
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg hover:border-border-strong focus:border-accent"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimated Deal Value with Quick Presets */}
          <div>
            <div className="flex items-baseline justify-between">
              <label className="block text-2xs font-semibold text-fg-subtle uppercase tracking-wider">
                Estimated Value (INR)
              </label>
              <div className="flex items-center gap-1">
                {VALUE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setEstValue(String(p.value))}
                    className="rounded border border-border bg-surface-raised px-1.5 py-0.5 text-3xs font-semibold text-fg-muted hover:border-accent hover:text-accent transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-semibold text-fg-subtle">
                ₹
              </span>
              <input
                type="text"
                value={estValue}
                onChange={(e) => setEstValue(e.target.value)}
                placeholder="60,000"
                className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-7 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-accent"
              />
            </div>
          </div>

          {/* Next Action */}
          <div>
            <label className="block text-2xs font-semibold text-fg-subtle uppercase tracking-wider">
              Next Best Action
            </label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Schedule counseling call for NEET batch"
              className="mt-1.5 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-accent"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-2xs font-semibold text-fg-subtle uppercase tracking-wider">
              Initial Note / Requirement
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Inquired about evening crash course batch timings and scholarship eligibility."
              className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface p-2.5 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-accent"
            />
          </div>

          {/* Modal Actions Footer */}
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !phone.trim()}>
              {busy ? 'Creating Lead…' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
