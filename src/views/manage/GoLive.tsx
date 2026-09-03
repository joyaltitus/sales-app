import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Rocket } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useClient } from '../../shell/ClientProvider'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { WriteFailure } from './shared'

// The go-live gate (AT-39). Both halves of it belong to the database:
// `pm_go_live_check` derives six checks and returns the manual acks alongside
// them, and `pm_ack_go_live_item` writes an ack. This screen adds no rule of its
// own — it renders what the RPC says and offers the one write it allows.
//
// AdminShell only: the check walls on manager|client_admin but the ack walls on
// client_admin, so a manager would get a page of read-only rows with an Ack
// button that always came back `forbidden`. The rail does not paint a door a
// role cannot walk through.

type AutoKey =
  | 'blocks_activated'
  | 'no_dangling_refs'
  | 'persona_applied'
  | 'profile_applied'
  | 'scorecard_fresh'
  | 'channel_wired'

type Ack = { acked: boolean; note: string | null; acked_by: string | null; acked_at: string | null }

export type GoLiveCheck = {
  ok: true
  client_id: string
  auto: Record<AutoKey, boolean>
  manual_acks: Record<string, Ack>
  ready: boolean
}

/** Plain language, no engine jargon — the person reading this owns the
 *  business, not the router. `fix` says what to do, because a red row that does
 *  not name its remedy is a dead end. */
const AUTO_COPY: Record<AutoKey, { label: string; fix: string }> = {
  blocks_activated: { label: 'Everything imported is switched on', fix: 'Some imported content is still a draft. Activate it under Your setup.' },
  no_dangling_refs: { label: 'Every answer points somewhere real', fix: 'Something points at a product, reply or stage that no longer exists. Open Your setup to fix it.' },
  persona_applied: { label: 'Your assistant’s voice is applied', fix: 'The voice has an unapplied draft, or was never compiled. Apply it under Your setup.' },
  profile_applied: { label: 'Your business profile is applied', fix: 'The profile has an unapplied draft. Apply it under Your setup → Profile.' },
  scorecard_fresh: { label: 'The last test run still matches this setup', fix: 'Your setup changed after the last passing test run. Run the check again.' },
  channel_wired: { label: 'A WhatsApp number is connected', fix: 'No channel is connected, so nothing can send. Ask your admin to connect the number.' },
}

/** The six manual items pm_go_live_check returns. Any key it adds later still
 *  renders — the fallback is the key itself, never a dropped row. */
const MANUAL_COPY: Record<string, string> = {
  kickoff_interview: 'Kickoff interview done with the customer',
  persona_reviewed: 'A human read the assistant’s voice end to end',
  escalation_keywords_set: 'Escalation words agreed with the team',
  real_device_check: 'Sent and received on a real phone',
  escalation_alert_fired: 'A test escalation actually alerted someone',
  handover_walkthrough: 'Handover walkthrough done with the team',
}

function Row({ done, title, detail, action }: { done: boolean; title: string; detail?: string; action?: React.ReactNode }) {
  const Icon = done ? CircleCheck : CircleAlert
  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 last:border-0">
      <Icon aria-hidden size={17} className={done ? 'mt-0.5 shrink-0 text-success' : 'mt-0.5 shrink-0 text-warn'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {detail && <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{detail}</p>}
      </div>
      {action}
    </li>
  )
}

export function GoLive({ preview }: { preview?: GoLiveCheck } = {}) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = preview ? null : (activeClient?.id ?? null)
  const userId = session?.user?.id ?? null

  const [check, setCheck] = useState<GoLiveCheck | null>(preview ?? null)
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase.rpc('pm_go_live_check', { p_client_id: clientId })
    setLoading(false)
    if (err) {
      setCheck(null)
      setError(err.message)
      return
    }
    const result = data as GoLiveCheck | { ok: false; reason: string }
    if (!result?.ok) {
      setCheck(null)
      // The RPC answers a refusal in its return value, not by raising, so a
      // forbidden read would otherwise render as a blank checklist.
      setError(result && 'reason' in result ? result.reason : 'unknown')
      return
    }
    setError(null)
    setCheck(result)
  }, [clientId])

  useEffect(() => {
    if (preview) return
    void load()
  }, [load, preview])

  async function ack(item: string) {
    if (!clientId) return
    setBusy(item)
    setFailure(null)
    const { data, error: err } = await supabase.rpc('pm_ack_go_live_item', {
      p_client_id: clientId,
      p_item: item,
      p_note: null,
      p_auth_user_id: userId,
    })
    setBusy(null)
    const result = data as { ok: boolean; reason?: string } | null
    if (err || !result?.ok) {
      setFailure(err ? 'write_failed' : (result?.reason ?? 'write_failed'))
      return
    }
    // Re-read rather than patching local state: `ready` is the RPC's verdict on
    // all thirteen conditions at once, and recomputing it here would be a second
    // implementation of the gate that could disagree with the first.
    await load()
  }

  if (!preview && !clientId) {
    return <EmptyState title="No workspace" body="Pick a workspace to see its go-live checklist." />
  }
  if (loading) {
    return <div className="space-y-2 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></div>
  }
  if (error || !check) {
    return (
      <div className="p-4">
        <ErrorState
          title="Couldn’t load the go-live checklist."
          body={error === 'forbidden' ? 'Your role may not open this checklist.' : (error ?? 'No answer from the database.')}
          onRetry={() => void load()}
        />
      </div>
    )
  }

  const autoKeys = Object.keys(AUTO_COPY) as AutoKey[]
  const manualKeys = Object.keys(check.manual_acks)
  const outstanding =
    autoKeys.filter((key) => !check.auto[key]).length + manualKeys.filter((key) => !check.manual_acks[key].acked).length

  return (
    <div className="space-y-4 p-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-fg">Ready to go live</h1>
          {check.ready
            ? <Chip tone="success">Ready</Chip>
            : <Chip tone="warn">{outstanding} still open</Chip>}
        </div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-muted">
          The first list is checked continuously against your setup. The second is what only a
          person can confirm — tick each one after you have actually done it.
        </p>
      </header>

      {check.ready && (
        <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success-subtle px-3 py-2.5 text-xs font-semibold text-success" role="status">
          <Rocket aria-hidden size={15} /> Every check passes. This workspace is ready for customers.
        </div>
      )}

      <section>
        <h2 className="label-caps mb-2">Checked for you</h2>
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {autoKeys.map((key) => (
            <Row key={key} done={check.auto[key]} title={AUTO_COPY[key].label} detail={check.auto[key] ? undefined : AUTO_COPY[key].fix} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="label-caps mb-2">Confirm yourself</h2>
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {manualKeys.map((key) => {
            const entry = check.manual_acks[key]
            return (
              <Row
                key={key}
                done={entry.acked}
                title={MANUAL_COPY[key] ?? key}
                detail={entry.acked && entry.acked_at ? `Confirmed ${new Date(entry.acked_at).toLocaleDateString()}` : undefined}
                action={
                  entry.acked ? null : (
                    <Button size="sm" variant="secondary" disabled={busy === key} onClick={() => void ack(key)}>
                      {busy === key ? 'Saving…' : 'Mark done'}
                    </Button>
                  )
                }
              />
            )
          })}
        </ul>
        {failure && <WriteFailure code={failure} />}
      </section>
    </div>
  )
}
