import { useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { useRevisions, revertTo } from '../../lib/manage-data'
import type { Revision } from '../../lib/manage-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'

// History on every row (§G.2 rail 1). `record_revisions` is written by a
// SECURITY DEFINER trigger on every path — imports, RPCs, direct edits — so this
// drawer shows what happened, not what this screen happens to know about.
//
// ONE-TAP REVERT IS A FORWARD WRITE. It replays `before` through the same door
// the tab uses, which means the collision gate, the column locks and the
// honesty rails all run again, and the revert itself lands in history as a new
// row. A raw rewind would have to bypass all three and then edit the audit
// trail to hide that it had — and 037 gives the browser no write on
// record_revisions at all, precisely so that is impossible.

const OP_TONE: Record<Revision['op'], 'accent' | 'neutral' | 'danger'> = {
  insert: 'accent',
  update: 'neutral',
  delete: 'danger',
}

/** Plain language for the audit's `source` label. An operator reading their own
 *  history should not have to know which RPC set a GUC. */
const SOURCE_LABEL: Record<string, string> = {
  ui_edit: 'edited here',
  manage: 'edited here',
  import: 'came from an import',
  activate: 'went live with a batch',
}

/** The fields worth showing. A revision's `before`/`after` are whole-row
 *  snapshots; diffing them and showing only what moved is the difference
 *  between history and a wall of JSON. */
function changedFields(rev: Revision): string[] {
  const before = rev.before ?? {}
  const after = rev.after ?? {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const out: string[] = []
  for (const k of keys) {
    if (k === 'updated_at' || k === 'draft_updated_at' || k === 'created_at') continue
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out.push(k)
  }
  return out.sort()
}

function nameOf(userId: string | null, names: Map<string, string>): string {
  if (!userId) return 'the system'
  return names.get(userId) ?? 'someone on the team'
}

function RevisionRow({
  revision,
  names,
  clientId,
  userId,
  onReverted,
}: {
  revision: Revision
  names: Map<string, string>
  clientId: string
  userId: string | null
  onReverted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const fields = changedFields(revision)

  const revert = async () => {
    if (!userId) return
    setBusy(true)
    setFailure(null)
    const res = await revertTo(clientId, revision, userId)
    setBusy(false)
    if (res.ok) onReverted()
    else setFailure(res.code)
  }

  return (
    <li className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={OP_TONE[revision.op]}>{revision.op}</Chip>
        <span className="text-xs text-fg-muted">
          {nameOf(revision.actor, names)} · {SOURCE_LABEL[revision.source] ?? revision.source}
        </span>
        <time className="ml-auto text-2xs text-fg-subtle" dateTime={revision.created_at}>
          {new Date(revision.created_at).toLocaleString()}
        </time>
      </div>
      {fields.length > 0 ? (
        <p className="mt-1.5 text-xs text-fg">
          Changed <span className="font-medium">{fields.join(', ')}</span>
        </p>
      ) : null}
      {revision.before ? (
        <div className="mt-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={busy} loading={busy} onClick={() => void revert()}>
            <RotateCcw aria-hidden size={13} /> Restore this version
          </Button>
          <span className="text-2xs text-fg-subtle">Saved as a new edit, not a rewind.</span>
        </div>
      ) : null}
      {failure ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          <span className="font-mono font-semibold">{failure}</span>
          <span className="text-fg-muted"> — the restore was refused, nothing changed.</span>
        </p>
      ) : null}
    </li>
  )
}

export function HistoryDrawer({
  open,
  onClose,
  clientId,
  userId,
  tableName,
  recordPk,
  title,
  names,
  onReverted,
}: {
  open: boolean
  onClose: () => void
  clientId: string
  userId: string | null
  tableName: string
  recordPk: string | null
  title: string
  names: Map<string, string>
  onReverted: () => void
}) {
  const { items, loading, error, reload } = useRevisions(clientId, tableName, open ? recordPk : null)

  return (
    <Sheet open={open} onClose={onClose} title={`History — ${title}`}>
      {error ? (
        <ErrorState title="Couldn't load the history." body={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No changes recorded yet"
          body="Every edit to this row will appear here, whoever makes it."
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {items.map((rev) => (
            <RevisionRow
              key={rev.id}
              revision={rev}
              names={names}
              clientId={clientId}
              userId={userId}
              onReverted={() => {
                reload()
                onReverted()
              }}
            />
          ))}
        </ul>
      )}
    </Sheet>
  )
}

/** The trigger every row carries. Kept here so the five tabs cannot drift on
 *  what "open the history" looks like or which table name it passes. */
export function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label="Show change history">
      <History aria-hidden size={14} /> History
    </Button>
  )
}
