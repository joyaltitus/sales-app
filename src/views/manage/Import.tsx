import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, LockOpen, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { hubFetch } from '../../lib/api'
import type { HubResult } from '../../lib/api'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Input } from '../../ui/Input'
import { Skeleton } from '../../ui/Skeleton'
import { WriteFailure } from './shared'
import type { TabProps } from './shared'

// Import (S2-G) — a spreadsheet of existing customers becomes contacts, and
// NOTHING is messaged.
//
// The division of labour, which is why this file is short: every write is one
// authenticated call to hub-service, and every read is the `import_batches` row
// itself over PostgREST. The batch row IS the state machine (parsing →
// awaiting_mapping → ready → committing → committed | failed | undone) and the
// counts and guard state live on it, so this screen polls the row rather than
// asking the API what it just did. One source of truth, and a page reload after
// a browser crash resumes exactly where the operator left off.
//
// THE GUARD IS NOT THIS SCREEN'S. `messaging_mode` is born 'do_not_message' and
// only `pm_allow_import_messaging` can move it — behind a role wall, the first
// eight characters of the batch id typed back, an attestation, and a consent
// provenance that is not a purchased list. The typed echo below MIRRORS that
// check so the operator is not sent to the server to be told; the database still
// decides, and its refusal is shown verbatim.
//
// Wire note: the request field names below follow s-import-spec.md §4/§7 (the
// contract this lane was built to). Anything the service rejects comes back as
// its own `{error: code}` through hubFetch and is rendered raw, so a mismatch
// surfaces as a named refusal on screen rather than a silent no-op.

const PROVENANCE = [
  { value: 'past_customers', label: 'People who have bought from us' },
  { value: 'prior_enquiries', label: 'People who enquired before' },
  { value: 'referrals', label: 'Referrals' },
  { value: 'purchased_list', label: 'A list we bought' },
] as const

type Provenance = (typeof PROVENANCE)[number]['value']

type Counts = {
  rows?: number
  new?: number
  dup_in_file?: number
  dup_existing?: number
  invalid?: number
  blocked?: string
  inserted?: number
}

export type ImportBatch = {
  id: string
  filename: string | null
  status: 'parsing' | 'awaiting_mapping' | 'ready' | 'committing' | 'committed' | 'failed' | 'undone'
  counts: Counts
  consent: { provenance?: string; attestation?: string }
  messaging_mode: 'do_not_message' | 'allowed'
  stage_failed: string | null
  created_at: string
}

const COLUMNS = 'id, filename, status, counts, consent, messaging_mode, stage_failed, created_at'

/** A batch is still moving while a worker owns it. Only these two states are
 *  worth polling for; every other one is either terminal or waiting on a human. */
const IN_FLIGHT = new Set(['parsing', 'committing'])

const STATUS_COPY: Record<ImportBatch['status'], string> = {
  parsing: 'Reading the file…',
  awaiting_mapping: 'Needs a look — too many rows had no usable phone number',
  ready: 'Checked, not added yet',
  committing: 'Adding contacts…',
  committed: 'Added',
  failed: 'Failed',
  undone: 'Undone',
}

/** The operator's last cheap look before the expensive act (spec E8). Rendered
 *  from the counts the dry run wrote, never recomputed here. */
export function countsLine(counts: Counts): string {
  if (counts.rows === undefined) return 'Not checked yet'
  const dup = (counts.dup_in_file ?? 0) + (counts.dup_existing ?? 0)
  return `${counts.new ?? 0} new · ${dup} duplicates · ${counts.invalid ?? 0} unusable`
}

/** The typed echo the unlock RPC demands. Mirrored, not invented: it is
 *  `left(batch_id::text, 8)` on the database side. */
export function confirmToken(batchId: string): string {
  return batchId.slice(0, 8)
}

function hubCode(res: HubResult<unknown>): string {
  return 'code' in res && res.code ? res.code : res.kind
}

function CohortCard({
  batch,
  clientId,
  onChanged,
}: {
  batch: ImportBatch
  clientId: string
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<'dry_run' | 'commit' | 'unlock' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [lifting, setLifting] = useState(false)
  const [echo, setEcho] = useState('')
  const [reason, setReason] = useState('')

  const post = async (action: string, body: Record<string, unknown> = {}) => {
    const res = await hubFetch(`/v1/import/batches/${batch.id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId, ...body }),
    })
    if (res.kind !== 'ok') {
      setFailure(hubCode(res))
      return false
    }
    setFailure(null)
    return true
  }

  const run = async (action: 'dry_run' | 'commit') => {
    setBusy(action)
    const ok = await post(action)
    setBusy(null)
    if (ok) onChanged()
  }

  const lift = async () => {
    setBusy('unlock')
    const ok = await post('unlock_messaging', { confirm: typedToken, attestation: reason.trim() })
    setBusy(null)
    if (!ok) return
    setLifting(false)
    setEcho('')
    setReason('')
    onChanged()
  }

  const purchased = batch.consent.provenance === 'purchased_list'
  const unlocked = batch.messaging_mode === 'allowed'
  const typedToken = echo.trim().toLowerCase()
  const echoMatches = typedToken === confirmToken(batch.id)

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-caps text-fg-subtle">{new Date(batch.created_at).toLocaleDateString()}</span>
        <h3 className="text-sm font-semibold text-fg">{batch.filename ?? 'Uploaded file'}</h3>
        <Chip tone={batch.status === 'failed' ? 'danger' : batch.status === 'committed' ? 'success' : 'neutral'}>
          {STATUS_COPY[batch.status]}
        </Chip>
        {unlocked ? (
          <Chip tone="warn">Messaging allowed</Chip>
        ) : (
          <Chip tone="neutral">Do not message</Chip>
        )}
      </div>

      <p className="tnum mt-2 text-sm text-fg">{countsLine(batch.counts)}</p>
      {batch.counts.blocked === 'invalid_ratio' && (
        <p className="mt-1 text-xs text-warn" role="alert">
          More than half the rows had no usable phone number. That is usually a column read the
          wrong way round, not bad data — send the file to your account manager.
        </p>
      )}
      {batch.stage_failed && (
        <p className="mt-1 text-xs text-danger" role="alert">
          Stopped at: <span className="font-mono">{batch.stage_failed}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {batch.status === 'awaiting_mapping' && (
          <Button size="sm" variant="secondary" disabled={busy !== null} loading={busy === 'dry_run'} onClick={() => void run('dry_run')}>
            Check again
          </Button>
        )}
        {batch.status === 'ready' && (
          <Button size="sm" disabled={busy !== null} loading={busy === 'commit'} onClick={() => void run('commit')}>
            Add {batch.counts.new ?? 0} contacts
          </Button>
        )}
        {batch.status === 'committed' && !unlocked && !purchased && (
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setLifting((v) => !v)}>
            <LockOpen aria-hidden size={13} /> Lift the messaging block
          </Button>
        )}
        {purchased && (
          <p className="flex items-center gap-1.5 text-xs text-fg-muted">
            <Lock aria-hidden size={13} /> A bought list can never be messaged from here. These
            contacts can still be worked by hand.
          </p>
        )}
      </div>

      {lifting && (
        <div className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--warn)_25%,transparent)] bg-warn-subtle p-3">
          <p className="text-xs leading-relaxed text-fg">
            These people never messaged you. Lifting the block lets campaigns and automatic
            replies reach them — and mass-messaging an old list is how a WhatsApp number gets
            restricted. Only lift it if you have their consent.
          </p>
          <label className="mt-2 block">
            <span className="label-caps">Type this code to confirm</span>
            {/* Outside the label, because `label-caps` uppercases its content
                and the database compares against `left(id::text, 8)` — a
                lowercase uuid. An operator typing back exactly what they saw
                would have been refused with no way to tell why. */}
            <span className="mt-0.5 block font-mono text-sm font-semibold text-fg">{confirmToken(batch.id)}</span>
            <Input className="mt-1" value={echo} onChange={(e) => setEcho(e.target.value)} aria-label="Confirmation code" />
          </label>
          <label className="mt-2 block">
            <span className="label-caps">Where did their consent come from?</span>
            <textarea
              className="mt-1 min-h-16 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Consent reason"
            />
            <span className="mt-1 block text-2xs text-fg-subtle">
              Recorded against your name. This is the record if anyone asks later.
            </span>
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setLifting(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!echoMatches || reason.trim() === '' || busy !== null}
              loading={busy === 'unlock'}
              onClick={() => void lift()}
            >
              Lift the block
            </Button>
          </div>
        </div>
      )}

      {failure ? <WriteFailure code={failure} /> : null}
    </article>
  )
}

function UploadCard({ clientId, onUploaded }: { clientId: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [provenance, setProvenance] = useState<Provenance | ''>('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const upload = async () => {
    if (!file || !provenance) return
    setBusy(true)
    setFailure(null)
    const form = new FormData()
    form.append('file', file, file.name)
    form.append('client_id', clientId)
    form.append('consent_provenance', provenance)
    const res = await hubFetch('/v1/import/files', { method: 'POST', body: form })
    setBusy(false)
    if (res.kind !== 'ok') {
      setFailure(hubCode(res))
      return
    }
    setFile(null)
    setProvenance('')
    onUploaded()
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-fg">Add a list of contacts</h3>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-muted">
        A CSV with a column of phone numbers. Nothing is sent to anyone: the contacts arrive
        blocked from messaging, and stay that way until you unblock them one list at a time.
      </p>

      <label className="mt-3 block">
        <span className="label-caps">File</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block w-full text-xs text-fg file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-sunk file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <fieldset className="mt-3">
        <legend className="label-caps">Where did these people come from?</legend>
        <div className="mt-1 space-y-1">
          {PROVENANCE.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm text-fg">
              <input
                type="radio"
                name="provenance"
                value={p.value}
                checked={provenance === p.value}
                onChange={() => setProvenance(p.value)}
              />
              {p.label}
            </label>
          ))}
        </div>
        {provenance === 'purchased_list' && (
          <p className="mt-1.5 text-xs text-warn" role="alert">
            A bought list can be stored and worked by hand, but can never be messaged. That is
            permanent for this file.
          </p>
        )}
      </fieldset>

      <div className="mt-3 flex justify-end">
        <Button disabled={!file || !provenance || busy} loading={busy} onClick={() => void upload()}>
          <Upload aria-hidden size={13} /> Upload
        </Button>
      </div>
      {failure ? <WriteFailure code={failure} /> : null}
    </article>
  )
}

export function Import({ clientId, preview }: TabProps<ImportBatch>) {
  const [items, setItems] = useState<ImportBatch[]>(preview ?? [])
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    // See LeadSources: the preview gallery has no session and makes no request.
    if (preview) return
    const { data, error: err } = await supabase
      .from('import_batches')
      .select(COLUMNS)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setItems((data ?? []) as unknown as ImportBatch[])
  }, [clientId, preview])

  useEffect(() => {
    void load()
  }, [load])

  // Parse and commit are worker jobs, so the row changes underneath us with no
  // request to hang a spinner on. One re-read while anything is in flight, and
  // none at all when nothing is — a screen that polls an idle tenant forever is
  // how a dashboard becomes the top query in the database.
  useEffect(() => {
    if (!items.some((b) => IN_FLIGHT.has(b.status))) return
    timer.current = setTimeout(() => void load(), 3000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [items, load])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (error) return <ErrorState title="Couldn’t load your imports." body={error} onRetry={() => void load()} />

  return (
    <div className="space-y-3">
      <UploadCard clientId={clientId} onUploaded={() => void load()} />
      {items.length === 0 ? (
        <EmptyState title="Nothing imported yet" body="Uploaded lists appear here with what happened to each one." />
      ) : (
        items.map((b) => <CohortCard key={b.id} batch={b} clientId={clientId} onChanged={() => void load()} />)
      )}
    </div>
  )
}
