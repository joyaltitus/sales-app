import { useEffect, useMemo, useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useLeadStages } from '../../lib/leads-data'
import {
  EMPTY_FILTERS,
  createBroadcast,
  estimateCost,
  resolveSegment,
  sendable,
  stopBroadcast,
  useBroadcasts,
  useCampaignOptions,
  useSegmentLeads,
  useWaTemplates,
} from '../../lib/outbound-data'
import type { Broadcast, Filters, WaTemplate } from '../../lib/outbound-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Input } from '../../ui/Input'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'

// BROADCASTS — segment blast, ported from Workbench (Outreach Session C).
// Pick a CRM-style segment → resolve distinct contacts → pick an approved
// template → confirm → write one `broadcasts` row and one pending `follow_ups`
// row per recipient. hub-service's broadcast drainer picks them up on its next
// tick (~1 min).
//
// This screen only ever WRITES ROWS. It never calls Meta and never sends. Every
// guarantee a reader might expect from it — opt-out suppression, the per-contact
// 24h template cap, the failure-spike stop — lives server-side, which is why the
// copy below promises none of them in the UI's own voice.

/** The raw code is always shown and `detail` is the database's own words — the
 *  do-not-message guard on an imported cohort refuses this insert, and that
 *  refusal has to reach the person looking at the screen verbatim rather than as
 *  a house paraphrase of a rule the house does not own. */
function Failure({ code, detail }: { code: string; detail?: string }) {
  return (
    <p className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger" role="alert">
      <span className="font-mono font-semibold">{code}</span>
      {detail ? <span className="text-fg-muted"> — {detail}</span> : null}
    </p>
  )
}

const statusTone = (s: string): 'accent' | 'success' | 'danger' | 'warn' | 'neutral' =>
  s === 'sending' ? 'accent' : s === 'done' ? 'success' : s === 'stopped' ? 'danger' : s === 'queued' ? 'warn' : 'neutral'

function fieldClass(extra = '') {
  return `mt-1 h-10 w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-fg ${extra}`
}

export function Broadcasts() {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = activeClient?.id ?? null
  const userId = session?.user?.id ?? null

  const { items, loading, error, reload } = useBroadcasts(clientId)
  const { items: templates } = useWaTemplates(clientId)
  const [newOpen, setNewOpen] = useState(false)
  const [stopFailure, setStopFailure] = useState<{ code: string; detail?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])

  if (!clientId) return <EmptyState title="No workspace" body="Pick a workspace to send from." />
  if (error) return <ErrorState title="Couldn't load broadcasts." body={error} onRetry={() => void reload()} />

  const stop = async (b: Broadcast) => {
    setStopFailure(null)
    const res = await stopBroadcast(b)
    if (!res.ok) {
      setStopFailure(res)
      return
    }
    setNotice('Broadcast stopped. Unsent recipients were cancelled.')
    void reload()
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">Broadcasts</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-muted">
            Pick who, pick an approved template, send. Opted-out contacts are excluded and each
            contact receives at most one template a day — both are enforced when the message is
            sent, not here.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>New broadcast</Button>
      </header>

      {notice && (
        <p className="rounded-md bg-surface-sunk px-3 py-2 text-xs text-fg-muted" role="status">
          {notice}
        </p>
      )}
      {stopFailure && <Failure code={stopFailure.code} detail={stopFailure.detail} />}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No broadcasts yet"
          body="Start one from a CRM segment — a stage, a campaign, or everyone above a value."
          action={<Button onClick={() => setNewOpen(true)}>New broadcast</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((b) => {
            const tpl = templateById.get(b.template_id)
            const c = b.counts ?? {}
            return (
              <li key={b.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-fg">{b.name}</span>
                      <Chip tone={statusTone(b.status)}>{b.status}</Chip>
                      {tpl && <Chip>{tpl.template_name}</Chip>}
                    </div>
                    <p className="tnum mt-0.5 text-2xs text-fg-subtle">
                      {new Date(b.created_at).toLocaleString()} · queued {c.queued ?? 0} · sent{' '}
                      {c.sent ?? 0} · failed {c.failed ?? 0} · replied {c.replied ?? 0}
                    </p>
                  </div>
                  {b.status === 'sending' && (
                    <Button variant="secondary" size="sm" onClick={() => void stop(b)}>
                      Stop
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <NewBroadcast
        open={newOpen}
        clientId={clientId}
        userId={userId}
        templates={templates}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setNewOpen(false)
          setNotice('Broadcast queued. Sending starts on the next tick, about a minute.')
          void reload()
        }}
      />
    </div>
  )
}

// Three steps: who → what → confirm. Split because the confirm step is the last
// place a mistake is cheap, and it needs the recipient count and the cost on one
// screen to be worth stopping at.
function NewBroadcast({
  open,
  clientId,
  userId,
  templates,
  onClose,
  onCreated,
}: {
  open: boolean
  clientId: string
  userId: string | null
  templates: WaTemplate[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [templateId, setTemplateId] = useState('')
  const [params, setParams] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{ code: string; detail?: string } | null>(null)

  const { stages } = useLeadStages(open ? clientId : null)
  const campaigns = useCampaignOptions(clientId, open)
  const { items: leads, loading: leadsLoading } = useSegmentLeads(clientId, open)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setName('')
    setFilters(EMPTY_FILTERS)
    setTemplateId('')
    setParams([])
    setFailure(null)
  }, [open])

  const sources = useMemo(() => [...new Set(leads.map((l) => l.source))].sort(), [leads])
  const { recipients, igExcluded } = useMemo(() => resolveSegment(leads, filters), [leads, filters])

  const template = templates.find((t) => t.id === templateId) ?? null
  const vars = template?.variables ?? []

  useEffect(() => {
    setParams(vars.map(() => ''))
    // Params are positional and belong to the chosen template; keeping the old
    // array would silently send one template's values under another's name.
  }, [templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }))

  const confirm = async () => {
    if (!userId || !template) return
    setBusy(true)
    setFailure(null)
    const res = await createBroadcast({
      clientId, userId, name, template, filters, recipients, params,
    })
    setBusy(false)
    if (res.ok) return onCreated()
    setFailure(res)
  }

  return (
    <Sheet open={open} onClose={onClose} title={`New broadcast — step ${step} of 3`}>
      {step === 1 && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Name (only you see this)</span>
            <Input
              className="mt-1"
              value={name}
              placeholder="July batch nudge"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Stage</span>
              <select className={fieldClass()} value={filters.stage} onChange={(e) => setFilter('stage', e.target.value)}>
                <option value="">any</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Status</span>
              <select className={fieldClass()} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                <option value="">any</option>
                <option value="open">open</option>
                <option value="won">won</option>
                <option value="lost">lost</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Source</span>
              <select className={fieldClass()} value={filters.source} onChange={(e) => setFilter('source', e.target.value)}>
                <option value="">any</option>
                {sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Channel</span>
              <select className={fieldClass()} value={filters.channel} onChange={(e) => setFilter('channel', e.target.value)}>
                <option value="">any</option>
                <option value="whatsapp">whatsapp</option>
                <option value="instagram">instagram</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Campaign</span>
              <select className={fieldClass()} value={filters.campaign} onChange={(e) => setFilter('campaign', e.target.value)}>
                <option value="">any</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Name or number</span>
              <Input className="mt-1" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Min value ₹</span>
              <Input className="mt-1" type="number" value={filters.minv} onChange={(e) => setFilter('minv', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-fg-muted">Max value ₹</span>
              <Input className="mt-1" type="number" value={filters.maxv} onChange={(e) => setFilter('maxv', e.target.value)} />
            </label>
          </div>

          <p className="rounded-md bg-surface-sunk px-3 py-2 text-sm text-fg-muted" data-testid="segment-count">
            <strong className="tnum text-fg">{leadsLoading ? '…' : recipients.length}</strong> opted-in
            WhatsApp contact{recipients.length === 1 ? '' : 's'} match this segment.
          </p>

          {igExcluded.length > 0 && (
            <p className="rounded-md bg-warn-subtle px-3 py-2 text-2xs text-warn" data-testid="ig-excluded">
              <strong className="tnum">{igExcluded.length}</strong> Instagram contact
              {igExcluded.length === 1 ? '' : 's'} left out — Instagram doesn't accept automated
              messages. Add a WhatsApp number to reach them.
              <span className="mt-1 block text-fg-muted">
                {igExcluded.slice(0, 5).join(', ')}
                {igExcluded.length > 5 ? '…' : ''}
              </span>
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={recipients.length === 0} onClick={() => setStep(2)}>Next: template</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-fg-muted">Template</span>
            <select className={fieldClass()} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template_name} ({t.language}, {t.category}) — {t.meta_status}
                  {t.active ? '' : ' · inactive'}
                </option>
              ))}
            </select>
          </label>

          {template && !sendable(template) && (
            <p className="rounded-md bg-danger-subtle px-3 py-2 text-2xs text-danger" role="alert">
              This template can't send yet — Meta status is {template.meta_status} and it is{' '}
              {template.active ? 'active' : 'inactive'}. Your account manager registers approvals.
            </p>
          )}

          {vars.length > 0 && (
            <div className="space-y-2">
              <p className="text-2xs text-fg-subtle">
                Fill each blank in order. Type <code>{'{{contact_name}}'}</code> anywhere to drop in
                each person's name.
              </p>
              {vars.map((v, i) => (
                <label key={v} className="block">
                  <span className="font-mono text-2xs text-fg-muted">{`{{${i + 1}}} ${v}`}</span>
                  <Input
                    className="mt-1"
                    value={params[i] ?? ''}
                    onChange={(e) =>
                      setParams((p) => {
                        const next = [...p]
                        next[i] = e.target.value
                        return next
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={!template || !sendable(template)} onClick={() => setStep(3)}>Next: confirm</Button>
          </div>
        </div>
      )}

      {step === 3 && template && (
        <div className="space-y-3">
          <div className="rounded-md bg-surface-sunk px-3 py-2.5 text-sm text-fg-muted">
            <p>
              <strong className="tnum text-fg">{recipients.length}</strong> recipients · template{' '}
              <strong className="text-fg">{template.template_name}</strong> ({template.category})
            </p>
            <p className="tnum mt-1 text-2xs text-fg-subtle">
              Roughly ₹{estimateCost(template.category, recipients.length).toFixed(2)} — an estimate
              by template category, not your Meta bill.
            </p>
          </div>

          <p className="rounded-md bg-warn-subtle px-3 py-2 text-2xs text-warn">
            Anyone who opted out is skipped. Each contact gets at most one template in 24 hours.
            Sending stops on its own if more than half the messages fail.
          </p>

          {template.body_preview && (
            <p className="rounded-md border border-border bg-surface-raised px-3 py-2 text-xs whitespace-pre-wrap text-fg-muted">
              {template.body_preview}
            </p>
          )}

          {failure && <Failure code={failure.code} detail={failure.detail} />}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button loading={busy} onClick={() => void confirm()}>
              <Send aria-hidden size={15} /> Send to {recipients.length}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
