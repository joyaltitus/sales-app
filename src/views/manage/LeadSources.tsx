import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Link2, PlugZap, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { CopyBox, WriteFailure } from './shared'
import type { TabProps } from './shared'

// Lead sources (S2-G) — the doors a lead can arrive through without anyone
// messaging us first.
//
// WHAT THIS SCREEN CAN AND CANNOT DO, because the shape is not a design choice:
// migration 077 grants the browser SELECT on `intake_source_configs` and nothing
// else — no INSERT, no UPDATE — and exactly two RPCs, `pm_intake_rotate_key` and
// `pm_intake_activate_source`. Creating a source and editing its mapping,
// template and rep pool were hub session S2-B's `pm_*` management RPCs, and S2-B
// is not built. So this screen LISTS, ISSUES KEYS and ACTIVATES, and renders the
// rest read-only rather than painting inputs whose save button cannot exist.
// When those RPCs land, the read-only lines below are where the editors go.
//
// The key is shown exactly once. `pm_intake_rotate_key` stores only its sha256,
// so a key nobody copied is a key that is gone — hence the copy box and the
// warning, not a toast that scrolls away.

const HUB_BASE = import.meta.env.VITE_HUB_API_BASE ?? ''

export type IntakeSource = {
  id: string
  source_key: string
  display_name: string
  mode: 'sandbox' | 'live'
  active: boolean
  key_last4: string
  key_rotated_at: string | null
  phone_field_path: string | null
  first_touch_template_id: string | null
  daily_first_touch_cap: number | null
  owner_pool: string[]
  door: string
  slug: string | null
}

const COLUMNS =
  'id, source_key, display_name, mode, active, key_last4, key_rotated_at, phone_field_path, ' +
  'first_touch_template_id, daily_first_touch_cap, owner_pool, door, slug'

/** Doors this screen knows how to explain. `email`, `meta`, `google` and `call`
 *  are declared in 077's CHECK but have no hub-side transport yet; a row on one
 *  of them still lists, with no snippet. */
const DOOR_LABEL: Record<string, string> = {
  api: 'Plain POST',
  form: 'Hosted form',
  embed: 'Embedded form',
  email: 'Email',
  meta: 'Lead Ads',
  google: 'Google',
  call: 'Missed call',
}

/** Every named refusal `pm_intake_activate_source` can answer, in the operator's
 *  language. An unknown reason still renders as its raw code (WriteFailure), so
 *  a hub-side addition is never swallowed. */
const ACTIVATION_HELP: Record<string, string> = {
  forbidden: 'Only an owner (client_admin) can switch a source live.',
  source_not_found: 'That source no longer exists.',
  phone_field_path_required: 'Nobody has told us which field in the incoming record holds the phone number.',
  daily_first_touch_cap_required: 'A daily message cap has to be set first — an unset cap blocks going live on purpose.',
  actor_not_a_member: 'The person this source sends as is no longer on the team.',
  template_required: 'No first-touch template is attached.',
  template_not_found: 'The attached template is not one of yours.',
  template_not_sendable: 'The attached template is not approved by Meta, or is switched off.',
  params_mismatch: 'The template expects a different number of values than the source fills in.',
}

/** The block a website owner pastes. An iframe of hub-service's own D-EMBED
 *  page rather than a script: the form's markup, validation and anti-bot floor
 *  are already frozen server-side, and a script would be a second copy of them
 *  living on someone else's page, unversioned. */
export function embedSnippet(base: string, slug: string): string {
  return `<iframe src="${base}/embed/v1/${slug}" title="Enquiry form"
        width="100%" height="520" style="border:0;max-width:520px"
        loading="lazy"></iframe>`
}

export function curlSnippet(base: string, key: string): string {
  return `curl -X POST ${base}/v1/intake/leads \\
  -H 'authorization: Bearer ${key}' \\
  -H 'content-type: application/json' \\
  -d '{"name":"Test Lead","phone":"9876543210"}'`
}

function ReadOnlyLine({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-2 py-1">
      <span className={ok ? 'text-success' : 'text-warn'} aria-hidden>
        {ok ? '✓' : '•'}
      </span>
      <span className="text-fg-muted">{label}</span>
      <span className="font-medium text-fg">{value}</span>
    </li>
  )
}

function SourceCard({
  source,
  clientId,
  userId,
  names,
  onChanged,
}: {
  source: IntakeSource
  clientId: string
  userId: string | null
  names: Map<string, string>
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<'key' | 'activate' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [issuedKey, setIssuedKey] = useState<string | null>(null)

  const rotate = async () => {
    if (!userId) return
    setBusy('key')
    setFailure(null)
    // RETURNS text and RAISES on refusal — unlike the activation RPC, which
    // answers its refusal in the body. Both shapes are handled where they occur.
    const { data, error } = await supabase.rpc('pm_intake_rotate_key', {
      p_client_id: clientId,
      p_source_config_id: source.id,
      p_auth_user_id: userId,
    })
    setBusy(null)
    if (error || typeof data !== 'string') {
      setFailure(error?.message ?? 'write_failed')
      return
    }
    setIssuedKey(data)
    onChanged()
  }

  const activate = async () => {
    if (!userId) return
    setBusy('activate')
    setFailure(null)
    const { data, error } = await supabase.rpc('pm_intake_activate_source', {
      p_client_id: clientId,
      p_source_config_id: source.id,
      p_auth_user_id: userId,
    })
    setBusy(null)
    const result = data as { ok: boolean; reason?: string } | null
    if (error || !result?.ok) {
      setFailure(error ? 'write_failed' : (result?.reason ?? 'write_failed'))
      return
    }
    onChanged()
  }

  const owners = source.owner_pool.map((id) => names.get(id) ?? id.slice(0, 8))
  const hasKey = source.key_rotated_at !== null

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-caps text-fg-subtle">{source.source_key}</span>
        <Chip tone="neutral">{DOOR_LABEL[source.door] ?? source.door}</Chip>
        {source.active ? <Chip tone="success">Live</Chip> : <Chip tone="warn">Not live</Chip>}
        {source.mode === 'sandbox' && <Chip tone="neutral">Sandbox — nothing is sent</Chip>}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-fg">{source.display_name}</h3>

      <ul className="mt-3 text-xs">
        <ReadOnlyLine
          ok={Boolean(source.phone_field_path)}
          label="Phone field"
          value={source.phone_field_path ?? 'not set'}
        />
        <ReadOnlyLine
          ok={Boolean(source.first_touch_template_id)}
          label="First-touch template"
          value={source.first_touch_template_id ? 'attached' : 'not set'}
        />
        <ReadOnlyLine
          ok={(source.daily_first_touch_cap ?? 0) > 0}
          label="Daily message cap"
          value={source.daily_first_touch_cap ? String(source.daily_first_touch_cap) : 'not set'}
        />
        <ReadOnlyLine
          ok={owners.length > 0}
          label="Leads go to"
          value={owners.length > 0 ? owners.join(', ') : 'nobody yet — leads arrive unassigned'}
        />
      </ul>
      <p className="mt-2 text-2xs leading-relaxed text-fg-subtle">
        These four are set by your account manager for now. A source cannot go live until the
        first three are filled in — that refusal is the database’s, not this screen’s.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-fg-muted">
          {hasKey ? (
            <>
              Key ends <span className="font-mono font-semibold">{source.key_last4}</span> · issued{' '}
              {new Date(source.key_rotated_at as string).toLocaleDateString()}
            </>
          ) : (
            'No key issued yet.'
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy !== null} loading={busy === 'key'} onClick={() => void rotate()}>
            <KeyRound aria-hidden size={13} /> {hasKey ? 'Replace key' : 'Create key'}
          </Button>
          {!source.active && (
            <Button size="sm" disabled={busy !== null} loading={busy === 'activate'} onClick={() => void activate()}>
              Go live
            </Button>
          )}
        </div>
      </div>

      {issuedKey && (
        <div className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--warn)_25%,transparent)] bg-warn-subtle p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warn">
            <TriangleAlert aria-hidden size={13} /> Copy this now. It is never shown again.
          </p>
          <CopyBox label="Key" value={issuedKey} />
          {source.door === 'api' && (
            <CopyBox
              label="Send a test lead"
              value={curlSnippet(HUB_BASE, issuedKey)}
              hint="Anything that can POST JSON — IndiaMART, Zapier, your website’s backend — sends the same shape."
            />
          )}
        </div>
      )}

      {source.door === 'api' && (
        <CopyBox
          label="Post leads to"
          value={`${HUB_BASE}/v1/intake/leads`}
          hint="Send the key as `authorization: Bearer …`. The key decides which workspace the lead lands in."
        />
      )}
      {source.slug && (source.door === 'form' || source.door === 'embed') && (
        <>
          <CopyBox
            label="Link to the form"
            value={`${HUB_BASE}/f/${source.slug}`}
            hint="Put this in a bio, an ad, or a QR code."
          />
          <CopyBox
            label="Or paste this into the website"
            value={embedSnippet(HUB_BASE, source.slug)}
            hint="Drops the same form inside any page. No script, no build step."
          />
        </>
      )}

      {failure ? <WriteFailure code={failure} /> : null}
      {failure && ACTIVATION_HELP[failure] ? (
        <p className="mt-1 text-xs text-fg-muted">{ACTIVATION_HELP[failure]}</p>
      ) : null}
    </article>
  )
}

export function LeadSources({ clientId, userId, names, preview }: TabProps<IntakeSource>) {
  const [items, setItems] = useState<IntakeSource[]>(preview ?? [])
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // The /preview gallery renders fixed rows with no session and no network,
    // so a re-read after a write would be the one call that escapes it.
    if (preview) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('intake_source_configs')
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
    setItems((data ?? []) as unknown as IntakeSource[])
  }, [clientId, preview])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (error) return <ErrorState title="Couldn’t load your lead sources." body={error} onRetry={() => void load()} />

  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-xs leading-relaxed text-fg-muted">
        Ways a lead can reach you without messaging first — a form on your site, or another
        system posting the enquiry across. Each one gets its own key, so you can switch one off
        without touching the others.
      </p>

      {items.length === 0 ? (
        <EmptyState
          title="No lead sources yet"
          body="Your account manager sets these up. Once one exists, its key and its form link appear here."
        />
      ) : (
        items.map((s) => (
          <SourceCard key={s.id} source={s} clientId={clientId} userId={userId} names={names} onChanged={() => void load()} />
        ))
      )}

      {/* Deliberately an empty slot, not a hidden one: Lead Ads is the door
          tenants ask for first, and a screen that simply omits it reads as
          "not supported" rather than "not yet". The hub-side door (D-META) is
          not built. */}
      <article className="rounded-lg border border-dashed border-border bg-surface-sunk p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PlugZap aria-hidden size={15} className="text-fg-subtle" />
          <h3 className="text-sm font-semibold text-fg">Facebook &amp; Instagram Lead Ads</h3>
          <Chip tone="neutral">Not connected yet</Chip>
        </div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-fg-muted">
          Leads filled in inside Facebook or Instagram will land here automatically once the
          connection is built. Until then, point the ad at your hosted form above — the lead
          arrives the same way and is attributed to the same campaign.
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-fg-subtle">
          <Link2 aria-hidden size={12} /> Nothing to do here yet.
        </p>
      </article>
    </div>
  )
}
