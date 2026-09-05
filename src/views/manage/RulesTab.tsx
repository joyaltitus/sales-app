import { useState } from 'react'
import { Lock, MessagesSquare } from 'lucide-react'
import {
  useObjectionRules,
  useBundles,
  editRuleResponse,
  honestyLint,
  triggerSentence,
} from '../../lib/manage-data'
import type { Bundle, Rule } from '../../lib/manage-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { HistoryButton, HistoryDrawer } from './HistoryDrawer'
import { HonestyNotes, WriteFailure } from './shared'
import type { TabProps } from './shared'

// Objection replies — `playbook_rules.response_text` on the 400 band and any
// TELL rule. This is the sharpest edge of the whole tier split.
//
// The table is super_admin-write. What the client owns is WHAT the bot says,
// never WHEN it says it — so the door is `pm_edit_rule_response`, a SECURITY
// DEFINER RPC that can reach exactly two columns and leaves every other column
// of the named rule byte-identical. There is no version of this screen that can
// change a trigger word, a priority or a chain, however the browser is
// manipulated, because the door is two columns wide.
//
// Trigger words are therefore rendered as a READ-ONLY sentence rather than as a
// disabled field. A disabled input invites someone to look for the enabled one;
// a sentence says what fires this reply and moves on.

function RuleCard({
  rule,
  bundles,
  clientId,
  userId,
  names,
  onChanged,
}: {
  rule: Rule
  bundles: Bundle[]
  clientId: string
  userId: string | null
  names: Map<string, string>
  onChanged: () => void
}) {
  const [text, setText] = useState(rule.response_text)
  const [bundleKey, setBundleKey] = useState(rule.media_bundle_key ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const dirty = text !== rule.response_text || bundleKey !== (rule.media_bundle_key ?? '')
  const warnings = honestyLint(text)

  const save = async () => {
    if (text.trim() === '') return
    // `userId ?? ''` used to stand in the call below, which sends an empty
    // string as the acting user rather than not writing at all. Same guard as
    // CampaignsTab's save paths.
    if (!userId) return
    setBusy(true)
    setFailure(null)
    const res = await editRuleResponse(clientId, rule.rule_key, text.trim(), bundleKey || null, userId)
    setBusy(false)
    if (res.ok) onChanged()
    else setFailure(res.code)
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-2xs text-fg-subtle">
          <Lock aria-hidden size={11} /> {rule.rule_key}
        </span>
        {!rule.active && <Chip tone="neutral">Off</Chip>}
        <div className="ml-auto">
          <HistoryButton onClick={() => setHistoryOpen(true)} />
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{triggerSentence(rule)}</p>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-fg-muted">Reply</span>
        <textarea
          className="mt-1 min-h-28 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-fg-muted">Attach media</span>
        <select
          className="mt-1 h-10 w-full rounded-md border border-border bg-surface-raised px-2 text-sm text-fg"
          value={bundleKey}
          onChange={(e) => setBundleKey(e.target.value)}
        >
          <option value="">No media</option>
          {bundles.map((b) => (
            <option key={b.id} value={b.bundle_key}>
              {b.bundle_key}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-2xs text-fg-subtle">
          Existing bundles only. Ask us to add a new one.
        </span>
      </label>

      <HonestyNotes warnings={warnings} />
      {failure ? <WriteFailure code={failure} /> : null}

      <div className="mt-3 flex justify-end">
        <Button disabled={!dirty || busy || text.trim() === ''} loading={busy} onClick={() => void save()}>
          Save reply
        </Button>
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        clientId={clientId}
        userId={userId}
        tableName="playbook_rules"
        recordPk={rule.id}
        title={rule.rule_key}
        names={names}
        onReverted={onChanged}
      />
    </article>
  )
}

export function RulesTab({ clientId, userId, names, preview }: TabProps<Rule>) {
  const live = useObjectionRules(preview ? null : clientId)
  const bundlesQuery = useBundles(preview ? null : clientId)
  const items = preview ?? live.items

  if (live.error && !preview) {
    return <ErrorState title="Couldn't load your replies." body={live.error} onRetry={live.reload} />
  }
  if (live.loading && !preview) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No objection replies yet"
        body="These are the standard answers to price, timing and trust questions. Ask us to set the first ones up."
      />
    )
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <RuleCard
          key={r.id}
          rule={r}
          bundles={bundlesQuery.items}
          clientId={clientId}
          userId={userId}
          names={names}
          onChanged={live.reload}
        />
      ))}
    </div>
  )
}
