import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import type { Role } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useTeam } from '../../lib/team-data'
import { usePendingApprovals, approveGroup, canApproveFor } from '../../lib/approvals-data'
import type { ApprovalGroup } from '../../lib/approvals-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { WriteFailure } from '../manage/shared'

// Manager Approvals — the screen that makes AT-32 usable end to end.
//
// A rep asks the agent to do something a rep may not do alone. hub-service parks
// it as an `approval_pending` event and answers 202. Until now nothing in the
// web app could see those rows, so the ceremony existed and the queue did not.
//
// Two rules are mirrored here for the UI, and enforced for real by hub-service
// on every request:
//
//   1. NOBODY CLEARS THEIR OWN. The proposer sees "awaiting manager", never an
//      Approve button. hub-service answers `self_approval` (403) if one is
//      forged, and treats sending your own id as the approver as asking to
//      self-approve rather than as a typo to be quietly downgraded.
//   2. NOBODY SIGNS FOR SOMEONE ABOVE THEM. The write revalidates against the
//      PROPOSER's role, so a manager clearing a super_admin's proposal would be
//      authorising an action they cannot perform themselves.
//
// The write runs in the proposer's scope. A manager supplies authority, not
// reach — approving does not widen what the rep could do, it only lets what they
// already proposed proceed.

const ROLE_LABEL: Record<string, string> = {
  client_admin: 'Admin',
  manager: 'Manager',
  agent: 'Rep',
  super_admin: 'Platform',
}

/** The tool's args as the audit recorded them. `args_summary` is already the
 *  redacted, summary-field-filtered shape hub-service chose to persist — showing
 *  it verbatim is showing the approver exactly what they are signing for. */
function ArgsSummary({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length === 0) return null
  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-fg-subtle">{k}</dt>
          <dd className="min-w-0 truncate text-fg">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

function GroupCard({
  group,
  clientId,
  viewerId,
  viewerRole,
  proposerName,
  proposerRole,
  onChanged,
}: {
  group: ApprovalGroup
  clientId: string
  viewerId: string | null
  viewerRole: Role | undefined
  proposerName: string
  proposerRole: Role | undefined
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const isOwn = group.proposerId === viewerId
  const mayApprove = !isOwn && canApproveFor(viewerRole, proposerRole)

  const approve = async () => {
    setBusy(true)
    setFailure(null)
    const res = await approveGroup(clientId, group)
    setBusy(false)
    if (res.ok) onChanged()
    else setFailure(res.code)
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-fg">{proposerName}</p>
        {proposerRole ? <Chip tone="neutral">{ROLE_LABEL[proposerRole] ?? proposerRole}</Chip> : null}
        <time className="ml-auto text-2xs text-fg-subtle" dateTime={group.createdAt}>
          {new Date(group.createdAt).toLocaleString()}
        </time>
      </div>

      <ul className="mt-3 space-y-2">
        {group.steps.map((s) => (
          <li key={s.id} className="rounded-md border border-border bg-surface-sunk p-2.5">
            <p className="text-xs font-semibold text-fg">{s.tool}</p>
            <ArgsSummary args={s.argsSummary} />
          </li>
        ))}
      </ul>

      {failure ? <WriteFailure code={failure} /> : null}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {isOwn ? (
          <Chip tone="warn">Awaiting manager</Chip>
        ) : !mayApprove ? (
          <span className="text-xs text-fg-muted">
            This needs someone at or above {ROLE_LABEL[proposerRole ?? ''] ?? 'their'} level.
          </span>
        ) : (
          <>
            <span className="mr-auto text-2xs text-fg-subtle">
              Approving clears every step above; anything left out is dismissed.
            </span>
            <Button disabled={busy} loading={busy} onClick={() => void approve()}>
              Approve {group.steps.length > 1 ? `all ${group.steps.length}` : ''}
            </Button>
          </>
        )}
      </div>
    </article>
  )
}

export type ApprovalsDesignData = {
  groups: ApprovalGroup[]
  viewerId: string
  viewerRole: Role
  members: { user_id: string; display_name: string | null; role: Role }[]
}

export function ApprovalsView({ designData }: { designData?: ApprovalsDesignData } = {}) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const clientId = designData ? 'design-client' : (activeClient?.id ?? null)
  const live = usePendingApprovals(designData ? null : clientId)
  const { items: team } = useTeam(designData ? null : clientId)

  const members = designData?.members ?? team
  const byUser = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members])

  const groups = designData?.groups ?? live.groups
  const viewerId = designData ? designData.viewerId : (session?.user?.id ?? null)
  const viewerRole = designData ? designData.viewerRole : activeClient?.role

  if (!clientId) {
    return <EmptyState title="No workspace" body="Pick a workspace to see its approvals." />
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-fg">Approvals</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-muted">
          Actions the assistant proposed that need a manager's signature. The action runs with the
          person who asked for it — approving does not widen what they can reach.
        </p>
      </header>

      {live.error && !designData ? (
        <ErrorState title="Couldn't load approvals." body={live.error} onRetry={live.reload} />
      ) : live.loading && !designData ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing waiting"
          body="When someone proposes an action that needs a manager, it appears here."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const member = byUser.get(g.proposerId)
            return (
              <GroupCard
                key={`${g.sessionId}-${g.runId}`}
                group={g}
                clientId={clientId}
                viewerId={viewerId}
                viewerRole={viewerRole}
                proposerName={member?.display_name ?? 'A teammate'}
                proposerRole={member?.role}
                onChanged={live.reload}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
