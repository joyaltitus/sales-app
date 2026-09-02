import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import type { Role } from '../../shell/ClientProvider'
import { addTeamMember, disableTeamMember, mintableBy, useTeam } from '../../lib/team-data'
import type { TeamMember } from '../../lib/team-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Input } from '../../ui/Input'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'

// Team (AT-27) — the tenant's roster, for client_admin and manager.
//
// Reps never reach this screen, and the reason is RLS, not this component:
// `ucm_team_select` scopes the membership read to manager|client_admin. The
// shells simply do not paint a link a rep's data could not fill.
//
// Every refusal here is hub-service's word, printed verbatim — `role_above_caller`
// is the one that matters, and it is what a manager sees the moment they try to
// mint a manager. Rewording it would turn a precise answer about authority into
// a shrug.
const ROLE_LABEL: Record<string, string> = {
  client_admin: 'Admin',
  manager: 'Manager',
  agent: 'Rep',
  super_admin: 'Platform',
}

/** Plain-language gloss for the codes this screen can actually provoke.
 *  The raw code is ALWAYS shown next to it — the gloss is a courtesy, never a
 *  replacement, so an unrecognised code still reaches the operator intact. */
const CODE_HELP: Record<string, string> = {
  role_above_caller: 'That role is at or above your own. Only the level below you can be added.',
  existing_platform_user: 'That address already has an account on this platform.',
  bad_request: 'Check the email address and name.',
  forbidden: 'Your role may not do this.',
  no_key: 'This browser has no gateway key saved yet.',
  unavailable: 'hub-service could not reach its database. Nothing was changed.',
  invite_failed: 'The invite email could not be sent. Nothing was changed.',
}

function Failure({ code }: { code: string }) {
  return (
    <p className="mt-2 text-xs text-danger" role="alert">
      <span className="font-mono font-semibold">{code}</span>
      {CODE_HELP[code] ? <span className="text-fg-muted"> — {CODE_HELP[code]}</span> : null}
    </p>
  )
}

function AddMemberForm({
  clientId,
  role,
  onAdded,
}: {
  clientId: string
  role: Extract<Role, 'manager' | 'agent'>
  onAdded: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // Set only by a 409: attaching an address that already has an account
  // elsewhere is a write to a third party, so hub-service demands a second,
  // explicit attempt rather than doing it on a guess.
  const [needsConfirm, setNeedsConfirm] = useState(false)

  const submit = async (allowExistingUser: boolean) => {
    setBusy(true)
    setFailure(null)
    const res = await addTeamMember({
      clientId,
      email: email.trim(),
      role,
      displayName: name.trim(),
      allowExistingUser,
    })
    setBusy(false)
    if (res.kind === 'ok') {
      setEmail('')
      setName('')
      setNeedsConfirm(false)
      onAdded()
      return
    }
    if (res.kind === 'existing_platform_user') {
      setNeedsConfirm(true)
      setFailure('existing_platform_user')
      return
    }
    setNeedsConfirm(false)
    setFailure(res.code)
  }

  const label = role === 'manager' ? 'manager' : 'rep'
  const ready = email.trim().length > 0 && name.trim().length > 0

  return (
    <form
      className="rounded-lg border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !busy) void submit(false)
      }}
    >
      <p className="label-caps flex items-center gap-2">
        <UserPlus aria-hidden size={14} /> Add {label}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="sr-only" htmlFor={`team-name-${role}`}>
          Full name
        </label>
        <Input
          id={`team-name-${role}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          autoComplete="off"
        />
        <label className="sr-only" htmlFor={`team-email-${role}`}>
          Email address
        </label>
        <Input
          id={`team-email-${role}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          autoComplete="off"
        />
        <Button type="submit" disabled={!ready || busy} loading={busy}>
          Add {label}
        </Button>
      </div>
      {failure ? <Failure code={failure} /> : null}
      {needsConfirm ? (
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void submit(true)}
          >
            Add them to this workspace anyway
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setNeedsConfirm(false)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </form>
  )
}

function MemberRow({
  member,
  clientId,
  canDisable,
  onChanged,
}: {
  member: TeamMember
  clientId: string
  canDisable: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const disabled = member.disabled_at !== null

  const disableMember = async () => {
    setBusy(true)
    setFailure(null)
    const res = await disableTeamMember({ clientId, userId: member.user_id })
    setBusy(false)
    if (res.kind === 'ok') onChanged()
    else setFailure(res.code)
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className={['truncate text-sm font-semibold', disabled ? 'text-fg-muted' : 'text-fg'].join(' ')}>
          {member.display_name ?? 'Unnamed'}
        </p>
        {disabled ? (
          <p className="mt-0.5 text-2xs text-fg-subtle">
            Disabled{' '}
            <time dateTime={member.disabled_at ?? undefined}>
              {new Date(member.disabled_at as string).toLocaleDateString()}
            </time>
          </p>
        ) : null}
        {failure ? <Failure code={failure} /> : null}
      </div>
      <Chip tone={disabled ? 'neutral' : 'accent'}>{ROLE_LABEL[member.role] ?? member.role}</Chip>
      {disabled ? (
        <Chip tone="danger">Disabled</Chip>
      ) : canDisable ? (
        <Button variant="ghost" size="sm" disabled={busy} loading={busy} onClick={() => void disableMember()}>
          Disable
        </Button>
      ) : null}
    </li>
  )
}

/** `preview` feeds the /preview mock gallery (and screenshots) fixed rows with
 *  no session and no network. It never affects the signed-in path: without it
 *  the screen reads live rows under RLS exactly as before. */
export function TeamPage({
  preview,
}: {
  preview?: { members: TeamMember[]; role: Role; clientName?: string }
} = {}) {
  const { activeClient } = useClient()
  const live = useTeam(preview ? null : (activeClient?.id ?? null))

  const clientId = preview ? 'preview-client' : (activeClient?.id ?? null)
  const items = preview ? preview.members : live.items
  const loading = preview ? false : live.loading
  const error = preview ? null : live.error
  const reload = live.reload
  const mintable = mintableBy(preview ? preview.role : activeClient?.role)
  const workspaceName = preview ? (preview.clientName ?? 'this workspace') : activeClient?.name

  if (!clientId) {
    return <EmptyState title="No workspace" body="Pick a workspace to see its team." />
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-fg">Team</h1>
        <p className="mt-1 text-xs text-fg-muted">
          Everyone with access to {workspaceName ?? 'this workspace'}. Adding someone emails them
          an invite; disabling ends their access immediately.
        </p>
      </header>

      {mintable.map((role) => (
        <AddMemberForm key={role} clientId={clientId} role={role} onAdded={reload} />
      ))}

      {error ? (
        <ErrorState title="Couldn't load the team." body={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No teammates yet" body="Add a manager or a rep to get started." />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {items.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              clientId={clientId}
              // The ladder again, for the button only. A row at or above the
              // caller's level gets no Disable button, and hub-service would
              // refuse it with role_above_caller even if one were forged.
              canDisable={mintable.includes(m.role as Extract<Role, 'manager' | 'agent'>)}
              onChanged={reload}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
