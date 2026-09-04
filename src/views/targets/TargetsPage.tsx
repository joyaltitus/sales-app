import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useClient } from '../../shell/ClientProvider'
import { useTeam } from '../../lib/team-data'
import type { TeamMember } from '../../lib/team-data'
import { firstOfMonth, upsertTarget, useTeamTargets } from '../../lib/targets-data'
import type { TargetItem } from '../../lib/targets-data'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'

// Targets (AT-34) — a manager sets each rep's monthly number.
//
// Everything under this screen already existed: targets-data.ts owns the reads
// and the upsert (and their tests), and the rep's own read-only progress has
// been on Today since the WIRE session. The only thing missing was the manager
// side of it, so this file is a screen over two existing hooks and nothing more.
//
// The roster comes from useTeam — the same tenant-scoped membership read the
// Team page uses, so "who has a target" and "who is on the team" cannot drift
// apart into two different answers.
//
// `employee_targets_write` is manager|client_admin; a rep may read their own row
// and never write one. This screen is not that wall — it just does not paint a
// form the server would refuse.
const MONEY_MAX = 100_000_000

/** Rows are money. Refuse anything that is not a finite, non-negative number
 *  BEFORE it reaches the upsert — a NaN here would land as a real target. */
function parseMoney(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > MONEY_MAX) return null
  return Math.round(n)
}

function monthLabel(month: string): string {
  const d = new Date(`${month}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function shiftMonth(month: string, by: number): string {
  const d = new Date(`${month}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + by)
  return firstOfMonth(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function RepTargetRow({
  member,
  target,
  clientId,
  month,
  createdBy,
  onSaved,
}: {
  member: TeamMember
  target: TargetItem | undefined
  clientId: string
  month: string
  createdBy: string
  onSaved: () => void
}) {
  const [value, setValue] = useState('')
  const [incentive, setIncentive] = useState('')
  const [bonus, setBonus] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Re-seed when the row's stored target changes — switching month must not
  // leave last month's numbers sitting in the boxes looking like this month's.
  useEffect(() => {
    setValue(target ? String(target.target_value) : '')
    setIncentive(target ? String(target.incentive_per_won) : '')
    setBonus(target ? String(target.bonus_at_target) : '')
    setSaved(false)
    setFailure(null)
  }, [target, month])

  const parsed = {
    target: parseMoney(value),
    incentive: parseMoney(incentive),
    bonus: parseMoney(bonus),
  }
  // A target is the one required number; the two payout fields default to zero
  // rather than blocking a manager who only wants to set the number.
  const invalid =
    parsed.target === null ||
    (incentive.trim() !== '' && parsed.incentive === null) ||
    (bonus.trim() !== '' && parsed.bonus === null)

  const dirty =
    !target ||
    parsed.target !== target.target_value ||
    (parsed.incentive ?? 0) !== target.incentive_per_won ||
    (parsed.bonus ?? 0) !== target.bonus_at_target

  const save = async () => {
    if (invalid || parsed.target === null) return
    setBusy(true)
    setFailure(null)
    const res = await upsertTarget({
      clientId,
      userId: member.user_id,
      month,
      targetValue: parsed.target,
      incentivePerWon: parsed.incentive ?? 0,
      bonusAtTarget: parsed.bonus ?? 0,
      createdBy,
    })
    setBusy(false)
    if (res.ok) {
      setSaved(true)
      onSaved()
    } else {
      setFailure(res.message)
    }
  }

  return (
    <li className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,110px)_auto]">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{member.display_name ?? 'Unnamed'}</p>
          <p className="mt-0.5 text-2xs text-fg-subtle">
            {target ? 'Target set' : 'No target this month'}
          </p>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Target ₹</span>
          <Input
            inputMode="numeric"
            value={value}
            invalid={value.trim() !== '' && parsed.target === null}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`Monthly target for ${member.display_name ?? member.user_id}`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Per won ₹</span>
          <Input
            inputMode="numeric"
            value={incentive}
            invalid={incentive.trim() !== '' && parsed.incentive === null}
            onChange={(e) => setIncentive(e.target.value)}
            aria-label={`Incentive per won for ${member.display_name ?? member.user_id}`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Bonus ₹</span>
          <Input
            inputMode="numeric"
            value={bonus}
            invalid={bonus.trim() !== '' && parsed.bonus === null}
            onChange={(e) => setBonus(e.target.value)}
            aria-label={`Bonus at target for ${member.display_name ?? member.user_id}`}
          />
        </label>
        <Button size="sm" disabled={invalid || !dirty || busy} loading={busy} onClick={() => void save()}>
          {saved && !dirty ? 'Saved' : 'Save'}
        </Button>
      </div>
      {failure ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {failure}
        </p>
      ) : null}
    </li>
  )
}

export function TargetsPage({
  preview,
}: {
  preview?: { members: TeamMember[]; targets: TargetItem[] }
} = {}) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = preview ? 'preview-client' : (activeClient?.id ?? null)
  const createdBy = session?.user.id ?? ''
  const [month, setMonth] = useState(() => firstOfMonth())

  const team = useTeam(preview ? null : (activeClient?.id ?? null))
  const targets = useTeamTargets(preview ? null : clientId, month)

  const members = preview ? preview.members : team.items
  const targetRows = preview ? preview.targets : targets.items
  const loading = preview ? false : team.loading || targets.loading

  // Targets are a rep's number. Managers and admins carry the floor's, not one
  // of these rows, and a disabled membership is history — neither gets a row.
  const reps = useMemo(
    () => members.filter((m) => m.role === 'agent' && m.disabled_at === null),
    [members],
  )
  const byUser = useMemo(
    () => new Map(targetRows.map((t) => [t.user_id, t])),
    [targetRows],
  )

  const reload = () => {
    void targets.reload()
  }

  if (!clientId) {
    return <EmptyState title="No workspace" body="Pick a workspace to set targets." />
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">Targets</h1>
          <p className="mt-1 text-xs text-fg-muted">
            Each rep's number for the month. Reps see their own progress against it on Today, and
            cannot change it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            ←
          </Button>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold text-fg">
            {monthLabel(month)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            →
          </Button>
        </div>
      </header>

      {team.error ? (
        <ErrorState title="Couldn't load the team." body={team.error} onRetry={team.reload} />
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : reps.length === 0 ? (
        <EmptyState title="No reps yet" body="Add a rep on the Team page to set them a target." />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {reps.map((m) => (
            <RepTargetRow
              key={m.user_id}
              member={m}
              target={byUser.get(m.user_id)}
              clientId={clientId}
              month={month}
              createdBy={createdBy}
              onSaved={reload}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
