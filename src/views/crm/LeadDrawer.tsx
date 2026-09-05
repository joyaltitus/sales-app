import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, ExternalLink } from 'lucide-react'
import type { LeadItem, LeadStage } from '../../lib/leads-data'
import { saveLead } from '../../lib/crm-actions'
import { useNotes } from '../../lib/crm-data'
import { addNote } from '../../lib/crm-actions'
import { useAuth } from '../../auth/AuthProvider'
import { MemoryTab } from './MemoryTab'
import { leadTemperature } from '../../lib/temperature'
import { TempBadge } from './BoardView'
import { Avatar } from '../../ui/Avatar'
import { ChannelIcon } from '../../ui/ChannelIcon'
import { Button } from '../../ui/Button'
import { ObjectionCapture } from '../objections/ObjectionCapture'
import { ObjectionHistory } from '../objections/ObjectionHistory'
import { getWhatsAppUrl, formatPhone } from '../../lib/phone'
import { useRolePath } from '../../shell/RoleRouter'

// SA-05 lead drawer — the Workbench lead editor rebuilt: stage, status,
// est. value, temperature override, lost reason (required on a lost move,
// same stage_key gate), objection, notes. Saves are REAL `leads` updates
// under RLS, conditional on the stage the editor SAW (crm-actions.saveLead)
// so a concurrent move can't be silently overwritten. Inline panel on
// desktop; the caller decides the container (§1.10 #12).

const monoStyle = { fontFamily: 'var(--font-mono)' } as const

const field =
  'h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-fg-muted">
      {children}
    </span>
  )
}

export function LeadDrawer({
  clientId,
  lead,
  stages,
  onClose,
  onSaved,
}: {
  clientId: string
  lead: LeadItem
  stages: LeadStage[]
  onClose: () => void
  onSaved: () => void
}) {
  const rolePath = useRolePath()
  const { session } = useAuth()
  const name = lead.contact?.profile_name ?? lead.contact?.external_id ?? 'Unknown contact'

  const [stageId, setStageId] = useState(lead.stage_id)
  const [status, setStatus] = useState(lead.status)
  const [estValue, setEstValue] = useState(lead.est_value == null ? '' : String(lead.est_value))
  const [tempOverride, setTempOverride] = useState(lead.temperature_override ?? '')
  const [lostReason, setLostReason] = useState(lead.lost_reason ?? '')
  const [objection, setObjection] = useState(lead.objection ?? '')
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'denied' | 'error' | 'need_reason'>(
    'idle',
  )
  const [tab, setTab] = useState<'details' | 'memory'>('details')

  // Re-sync when another lead is opened in the same mounted drawer.
  useEffect(() => {
    setStageId(lead.stage_id)
    setStatus(lead.status)
    setEstValue(lead.est_value == null ? '' : String(lead.est_value))
    setTempOverride(lead.temperature_override ?? '')
    setLostReason(lead.lost_reason ?? '')
    setObjection(lead.objection ?? '')
    setState('idle')
  }, [lead])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const targetStage = stages.find((s) => s.id === stageId)
  // Workbench's gate: moving into a lost-ish stage or setting status=lost
  // requires a reason.
  const lostMove =
    status === 'lost' || targetStage?.stage_key === 'lost' || targetStage?.stage_key === 'not_interested'

  const { temp, overridden } = useMemo(
    () =>
      leadTemperature(
        lead,
        stages,
        false,
        lead.conversation?.last_customer_message_at ?? null,
        Date.now(),
      ),
    [lead, stages],
  )

  const save = async () => {
    if (lostMove && !lostReason.trim()) {
      setState('need_reason')
      return
    }
    setState('busy')
    const effectiveStatus = targetStage?.is_won ? 'won' : lostMove ? 'lost' : status
    const res = await saveLead(clientId, lead.id, lead.stage_id, {
      stage_id: stageId,
      status: effectiveStatus,
      est_value: estValue.trim() === '' ? null : Number(estValue),
      temperature_override: tempOverride === '' ? null : tempOverride,
      lost_reason: lostMove ? lostReason.trim() : null,
      objection: objection.trim() === '' ? null : objection.trim(),
    })
    if (res.ok) {
      setState('saved')
      onSaved()
      return
    }
    setState(res.reason === 'denied' ? 'denied' : 'error')
  }

  // Notes on the lead.
  const { items: notes, reload: reloadNotes } = useNotes(clientId, { leadId: lead.id })
  const [noteDraft, setNoteDraft] = useState('')
  // The `if (res.ok)` below had no else, so a refused note left the draft
  // sitting in the box with no indication it had not been saved. Error slot
  // copied from ContextRail's submitNote, which already got this right.
  const [noteErr, setNoteErr] = useState(false)
  const submitNote = async () => {
    const body = noteDraft.trim()
    if (!body) return
    setNoteErr(false)
    const res = await addNote(clientId, {
      conversation_id: lead.conversation_id,
      lead_id: lead.id,
      author: session?.user?.email ?? null,
      body,
    })
    if (!res.ok) {
      setNoteErr(true)
      return
    }
    setNoteDraft('')
    void reloadNotes()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-surface-raised px-4 py-3">
        <Avatar name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-md font-semibold text-fg">{name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <ChannelIcon channel={lead.contact?.channel ?? null} size={12} />
            <span className="tnum truncate text-2xs text-fg-subtle" style={monoStyle}>
              {formatPhone(lead.contact?.external_id)}
            </span>
            {lead.contact?.channel === 'whatsapp' && lead.contact?.external_id && (
              <a
                href={getWhatsAppUrl(lead.contact.external_id) ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in WhatsApp"
                aria-label="Open in WhatsApp"
                className="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-3xs font-semibold text-fg-muted transition-colors hover:border-[#25D366]/50 hover:bg-[#25D366]/10 hover:text-fg"
              >
                <ExternalLink aria-hidden size={9} />
                <span>WhatsApp</span>
              </a>
            )}
            <TempBadge temp={temp} overridden={overridden} />
          </div>
        </div>
        {lead.conversation_id && (
          <Link
            to={rolePath(`/inbox?c=${lead.conversation_id}`)}
            className="shrink-0 text-xs text-fg-muted hover:text-fg"
          >
            Open conversation →
          </Link>
        )}
        <button
          onClick={onClose}
          aria-label="Close lead"
          className="shrink-0 rounded-sm p-1.5 text-fg-subtle hover:bg-surface-sunk hover:text-fg"
        >
          <X aria-hidden size={15} strokeWidth={1.75} />
        </button>
      </header>

      {/* UI-BUILD-02: Details | Memory (Lead Brain) tabs */}
      <div className="flex gap-1 border-b border-border px-4 pt-2">
        {(['details', 'memory'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-selected={tab === t}
            role="tab"
            className={[
              'rounded-t-sm border-b-2 px-3 py-1.5 text-xs transition-colors',
              tab === t
                ? 'border-accent font-semibold text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            {t === 'details' ? 'Details' : 'Memory'}
          </button>
        ))}
      </div>

      {tab === 'memory' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <MemoryTab clientId={clientId} lead={lead} />
        </div>
      ) : (
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Stage</Label>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={field}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <Label>Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>
          <div className="block">
            <div className="flex items-baseline justify-between">
              <Label>Est. value (₹)</Label>
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={estValue}
              onChange={(e) => setEstValue(e.target.value)}
              placeholder="—"
              className={[field, 'tnum'].join(' ')}
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {[
                ['25K', '25000'],
                ['50K', '50000'],
                ['60K', '60000'],
                ['1L', '100000'],
                ['1.5L', '150000'],
              ].map(([lbl, val]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setEstValue(val)}
                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-3xs font-semibold text-fg-muted hover:border-accent hover:text-accent transition-colors"
                >
                  ₹{lbl}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <Label>Temperature</Label>
            <select
              value={tempOverride}
              onChange={(e) => setTempOverride(e.target.value)}
              className={field}
            >
              <option value="">Auto</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </label>
        </div>

        <ObjectionCapture contactId={lead.contact_id} leadId={lead.id} source="crm" detected={null} />

        <label className="block">
          <Label>Current objection note (live field)</Label>
          <input
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            placeholder="What's holding them back"
            className={field}
          />
        </label>

        <ObjectionHistory contactId={lead.contact_id} />

        {lostMove && (
          <label className="block">
            <Label>Lost reason (required)</Label>
            <input
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Why this didn't work out"
              className={field}
            />
          </label>
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => void save()} loading={state === 'busy'}>
            Save lead
          </Button>
          {state === 'saved' && <span className="text-xs text-success">Saved</span>}
          {state === 'need_reason' && (
            <span className="text-xs text-danger">A lost lead needs a reason.</span>
          )}
          {state === 'denied' && (
            <span className="text-xs text-danger">
              Save didn't go through — no permission on this lead, or it changed elsewhere.
            </span>
          )}
          {state === 'error' && (
            <span className="text-xs text-danger">Save failed. Check connection and try again.</span>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <Label>Notes</Label>
          {notes.length === 0 && <p className="text-xs text-fg-subtle">No notes yet.</p>}
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id}>
                <p className="text-xs text-fg">{n.body}</p>
                <p className="tnum mt-0.5 text-2xs text-fg-subtle" style={monoStyle}>
                  {new Date(n.created_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {n.author ? ` · ${n.author}` : ''}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitNote()
              }}
              placeholder="Add note"
              aria-label="Add note"
              className={field}
            />
            <Button variant="secondary" size="sm" onClick={() => void submitNote()} disabled={!noteDraft.trim()}>
              Add
            </Button>
          </div>
          {noteErr && <p role="alert" className="mt-1 text-2xs text-danger">Couldn't save the note. Try again.</p>}
        </div>
      </div>
      )}
    </div>
  )
}
