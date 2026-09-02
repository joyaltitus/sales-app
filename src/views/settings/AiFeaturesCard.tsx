import { useState } from 'react'
import { useClient } from '../../shell/ClientProvider'
import type { Role } from '../../shell/ClientProvider'
import { featureEffect, updateFeatureGrant, useFeatureGrants } from '../../lib/featureOn'
import type { FeatureGrant } from '../../lib/featureOn'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'

// AI features (AT-28) — the tenant's entitlement card, client_admin surface.
//
// Three columns, three authorities, and the UI has to make that legible:
//   • `granted` is the PLAN. Read-only here, always: 045's trigger rejects a
//     browser write to it even when RLS would allow the row. So this renders a
//     badge and offers no control at all — not a disabled toggle, which would
//     imply the control exists and is merely unavailable today.
//   • `enabled` and `enabled_roles` are the tenant's own, written straight
//     through the anon client under `feature_grants_update` (client_admin only).
//
// Turning a feature off here is a product decision, not a security boundary:
// the server re-derives entitlement on every request regardless of what this
// card says.
const ROLE_CHIPS: Array<{ role: Extract<Role, 'agent' | 'manager' | 'client_admin'>; label: string }> = [
  { role: 'agent', label: 'Reps' },
  { role: 'manager', label: 'Managers' },
  { role: 'client_admin', label: 'Admins' },
]

function prettyName(feature: string): string {
  return feature.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function GrantRow({ grant, onChanged }: { grant: FeatureGrant; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const effect = featureEffect(grant.feature)

  const write = async (patch: { enabled?: boolean; enabled_roles?: string[] }) => {
    setBusy(true)
    setFailure(null)
    const res = await updateFeatureGrant(grant.id, patch)
    setBusy(false)
    if (res.ok) onChanged()
    else setFailure(res.message)
  }

  const toggleRole = (role: string) => {
    const next = grant.enabled_roles.includes(role)
      ? grant.enabled_roles.filter((r) => r !== role)
      : [...grant.enabled_roles, role]
    void write({ enabled_roles: next })
  }

  return (
    <li className="border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{prettyName(grant.feature)}</p>
          {effect ? <p className="mt-1 text-xs leading-relaxed text-fg-muted">{effect}</p> : null}
        </div>
        {/* The plan, stated — never a control. */}
        <Chip tone={grant.granted ? 'success' : 'neutral'}>
          {grant.granted ? 'in your plan' : 'not in your plan'}
        </Chip>
      </div>

      {grant.granted ? (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-fg">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={grant.enabled}
              disabled={busy}
              onChange={(e) => void write({ enabled: e.target.checked })}
            />
            Switched on
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps text-fg-subtle">Visible to</span>
            {ROLE_CHIPS.map(({ role, label }) => {
              const on = grant.enabled_roles.includes(role)
              return (
                <button
                  key={role}
                  type="button"
                  disabled={busy || !grant.enabled}
                  aria-pressed={on}
                  onClick={() => toggleRole(role)}
                  className="rounded-pill disabled:opacity-45"
                >
                  <Chip tone={on ? 'accent' : 'neutral'}>{label}</Chip>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-subtle">
          Talk to your account manager to add this to your plan.
        </p>
      )}

      {failure ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {failure}
        </p>
      ) : null}
    </li>
  )
}

/** `preview` feeds the /preview mock gallery fixed rows with no session and no
 *  network; the signed-in path is untouched. */
export function AiFeaturesCard({ preview }: { preview?: FeatureGrant[] } = {}) {
  const { activeClient } = useClient()
  const live = useFeatureGrants(preview ? null : (activeClient?.id ?? null))
  const grants = preview ?? live.grants
  const loading = preview ? false : live.loading
  const error = preview ? null : live.error
  const reload = live.reload

  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">AI features</h2>
        <p className="mt-1 text-xs text-fg-muted">
          What your plan includes, and which of it is switched on for whom.
        </p>
      </header>
      {error ? (
        <div className="p-4">
          <ErrorState title="Couldn't load your features." body={error} onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : grants.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No AI features yet" body="Nothing has been added to this plan." />
        </div>
      ) : (
        <ul>
          {grants.map((g) => (
            <GrantRow key={g.id} grant={g} onChanged={reload} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function AdminSettings() {
  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-fg">Settings</h1>
      </header>
      <AiFeaturesCard />
    </div>
  )
}
