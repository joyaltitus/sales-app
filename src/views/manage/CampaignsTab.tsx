import { useEffect, useState } from 'react'
import { Megaphone, MessageSquare, Plus, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  useCampaigns,
  createCampaign,
  saveCampaign,
  setCampaignTrigger,
  setCampaignSpend,
  deactivateRecord,
  honestyLint,
  CAMPAIGN_CHANNELS,
} from '../../lib/manage-data'
import type { Campaign, Collision } from '../../lib/manage-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Input } from '../../ui/Input'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { HistoryButton, HistoryDrawer } from './HistoryDrawer'
import { Collisions, CopyBox, HonestyNotes, KeywordExpander, RefsNote, WriteFailure } from './shared'
import type { TabProps } from './shared'

// Campaigns — three different write paths on one card, because 069 locks two of
// this table's columns against browser writes:
//
//   name / context_text / dates / active → ordinary PostgREST update
//   trigger (code words + ad ids)        → pm_set_campaign_trigger
//   spend_minor                          → pm_set_campaign_spend
//
// The locks are not bureaucracy. A code word decides which inbound text is
// claimed by which campaign, so one that collides with the opt-out lexicon
// silently eats every customer's "STOP" — no crash, no error, just a customer
// who cannot leave. The RPC refuses the whole write on that collision and says
// which word did it, which is why code words are never part of the plain save.
//
// Spend is separated for a duller reason: it is the ROI denominator, and a typo
// in it quietly rewrites every cost-per-lead number on the attribution screen.

/** Money is stored in MINOR units (paise). Converting at the two edges — here
 *  and in the ROI table — keeps a float out of the middle. */
function toMinor(major: string): number | null {
  const n = Number(major)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function CampaignCard({
  campaign,
  clientId,
  userId,
  names,
  displayNumber,
  onChanged,
}: {
  campaign: Campaign
  clientId: string
  userId: string | null
  names: Map<string, string>
  displayNumber: string | null
  onChanged: () => void
}) {
  const [name, setName] = useState(campaign.name)
  const [context, setContext] = useState(campaign.context_text ?? '')
  const [startsAt, setStartsAt] = useState(campaign.starts_at?.slice(0, 10) ?? '')
  const [endsAt, setEndsAt] = useState(campaign.ends_at?.slice(0, 10) ?? '')
  const [active, setActive] = useState(campaign.active)
  const [codeWords, setCodeWords] = useState<string[]>(campaign.trigger?.code_keywords ?? [])
  const [sourceIds, setSourceIds] = useState<string[]>(campaign.trigger?.ctwa_source_ids ?? [])
  const [spend, setSpend] = useState(String(campaign.spend_minor / 100))
  const [busy, setBusy] = useState<'details' | 'trigger' | 'spend' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [collisions, setCollisions] = useState<Collision[]>([])
  const [refs, setRefs] = useState<{ kind: string; ref: string }[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const detailsDirty =
    name !== campaign.name ||
    context !== (campaign.context_text ?? '') ||
    startsAt !== (campaign.starts_at?.slice(0, 10) ?? '') ||
    endsAt !== (campaign.ends_at?.slice(0, 10) ?? '') ||
    active !== campaign.active
  const triggerDirty =
    codeWords.join(' ') !== (campaign.trigger?.code_keywords ?? []).join(' ') ||
    sourceIds.join(' ') !== (campaign.trigger?.ctwa_source_ids ?? []).join(' ')
  const spendMinor = toMinor(spend)
  const spendDirty = spendMinor !== null && spendMinor !== campaign.spend_minor
  const datesBackwards = startsAt !== '' && endsAt !== '' && endsAt < startsAt

  const saveDetails = async () => {
    if (datesBackwards) return
    setBusy('details')
    setFailure(null)
    const res = await saveCampaign(clientId, campaign.id, {
      name: name.trim(),
      context_text: context.trim() || null,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      active,
    })
    setBusy(null)
    if (res.ok) onChanged()
    else setFailure(res.code)
  }

  const saveTrigger = async () => {
    if (!userId) return
    setBusy('trigger')
    setFailure(null)
    setCollisions([])
    const res = await setCampaignTrigger(clientId, campaign.campaign_key, codeWords, sourceIds, userId)
    setBusy(null)
    if (res.ok) {
      // Warnings are collisions the RPC ALLOWED — a knowledge overlap, say.
      // They are shown after a successful save because the operator should
      // know what they have just made ambiguous.
      setCollisions(res.warnings)
      onChanged()
      return
    }
    setCollisions(res.collisions)
    setFailure(res.code)
  }

  const saveSpend = async () => {
    if (!userId || spendMinor === null) return
    setBusy('spend')
    setFailure(null)
    const res = await setCampaignSpend(clientId, campaign.campaign_key, spendMinor, userId)
    setBusy(null)
    if (res.ok) onChanged()
    else setFailure(res.code)
  }

  const deactivate = async () => {
    if (!userId) return
    setBusy('details')
    setFailure(null)
    setRefs(null)
    const res = await deactivateRecord(clientId, 'campaign', campaign.campaign_key, userId)
    setBusy(null)
    if (!res.ok) {
      setFailure(res.code)
      return
    }
    setRefs(res.refs)
    onChanged()
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-2xs text-fg-subtle">{campaign.campaign_key}</span>
        <Chip tone={campaign.active ? 'accent' : 'neutral'}>{campaign.channel}</Chip>
        {!campaign.active && <Chip tone="neutral">Off</Chip>}
        <div className="ml-auto flex items-center gap-1">
          <HistoryButton onClick={() => setHistoryOpen(true)} />
          {campaign.active && (
            <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void deactivate()}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-fg-muted">Name</span>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-fg-muted">What the assistant may say about this campaign</span>
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
        <span className="mt-1 block text-2xs text-fg-subtle">
          The only campaign facts the assistant is allowed to state.
        </span>
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Starts</span>
          <Input className="mt-1" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Ends</span>
          <Input
            className="mt-1"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            aria-invalid={datesBackwards}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Running
      </label>

      {datesBackwards && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-danger" role="alert">
          <TriangleAlert aria-hidden size={13} /> The end date is before the start date.
        </p>
      )}
      <HonestyNotes warnings={honestyLint(context)} />
      <RefsNote refs={refs} noun="campaign" />

      <div className="mt-3 flex justify-end">
        <Button
          disabled={!detailsDirty || busy !== null || datesBackwards}
          loading={busy === 'details'}
          onClick={() => void saveDetails()}
        >
          Save details
        </Button>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <KeywordExpander
          label="Code words"
          words={codeWords}
          onChange={setCodeWords}
          hint="Typing one of these tells us the customer came from this campaign."
        />
        <div className="mt-3">
          <KeywordExpander
            label="Ad source ids"
            words={sourceIds}
            onChange={setSourceIds}
            hint="Click-to-WhatsApp source ids from the ad platform."
          />
        </div>
        <Collisions collisions={collisions} />
        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            disabled={!triggerDirty || busy !== null}
            loading={busy === 'trigger'}
            onClick={() => void saveTrigger()}
          >
            Save code words
          </Button>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Spend so far</span>
          <Input
            className="mt-1"
            inputMode="decimal"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            aria-invalid={spendMinor === null}
          />
          <span className="mt-1 block text-2xs text-fg-subtle">
            Feeds cost per lead and cost per sale on the Attribution screen.
          </span>
        </label>
        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            disabled={!spendDirty || busy !== null}
            loading={busy === 'spend'}
            onClick={() => void saveSpend()}
          >
            Save spend
          </Button>
        </div>
      </div>

      <WebsiteWidget campaign={campaign} displayNumber={displayNumber} />

      {failure ? <WriteFailure code={failure} /> : null}

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        clientId={clientId}
        userId={userId}
        tableName="campaigns"
        recordPk={campaign.id}
        title={campaign.name}
        names={names}
        onReverted={onChanged}
      />
    </article>
  )
}


// The website widget (S2-G). No backend, and deliberately so: a wa.me link with
// the campaign's code word pre-typed IS the attribution. The customer sends the
// word, the existing trigger matcher claims the conversation for this campaign,
// and nothing new has to be built, deployed or kept alive to make that work.
//
// It needs the tenant's own WhatsApp number in dialable form, which lives on
// `channel_accounts.display_number` and is NULL until someone fills it in. A
// link built on a missing number would be a broken link on a customer's website,
// so the block says what is missing instead of rendering one.

/** Bare digits — wa.me rejects '+', spaces and dashes. */
export function waDigits(displayNumber: string): string {
  return displayNumber.replace(/\D/g, '')
}

export function waLink(displayNumber: string, codeWord: string): string {
  return `https://wa.me/${waDigits(displayNumber)}?text=${encodeURIComponent(codeWord)}`
}

/** The paste-in floating button. Plain DOM, one anchor, no dependency and no
 *  build step — it has to survive being pasted into a Wix page, a WordPress
 *  footer widget or a hand-written index.html. */
export function floatingButtonSnippet(href: string): string {
  return `<script>
(function () {
  var a = document.createElement('a');
  a.href = '${href}';
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Chat on WhatsApp';
  a.setAttribute('aria-label', 'Chat with us on WhatsApp');
  a.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483000;background:#25D366;color:#fff;font:600 15px/1 system-ui,sans-serif;padding:14px 18px;border-radius:999px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25)';
  document.body.appendChild(a);
})();
</script>`
}

function WebsiteWidget({ campaign, displayNumber }: { campaign: Campaign; displayNumber: string | null }) {
  const codeWord = campaign.trigger?.code_keywords?.[0]
  if (!codeWord) return null

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-fg">
        <MessageSquare aria-hidden size={13} /> Put this campaign on your website
      </p>
      {displayNumber ? (
        <>
          <p className="mt-1 text-2xs leading-relaxed text-fg-subtle">
            Opens WhatsApp with “{codeWord}” already typed. Whoever sends it is counted against
            this campaign automatically.
          </p>
          <CopyBox label="Link" value={waLink(displayNumber, codeWord)} hint="Works in a bio, a button, a QR code." />
          <CopyBox
            label="Floating button"
            value={floatingButtonSnippet(waLink(displayNumber, codeWord))}
            hint="Paste before </body>. Nothing else to install."
          />
        </>
      ) : (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-warn" role="alert">
          <TriangleAlert aria-hidden size={13} />
          Your WhatsApp number is not filled in yet, so there is no link to give out. Ask your
          account manager to add it.
        </p>
      )}
    </div>
  )
}

function NewCampaignForm({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<string>('meta_ads')
  const [context, setContext] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus aria-hidden size={14} /> New campaign
      </Button>
    )
  }

  const datesBackwards = startsAt !== '' && endsAt !== '' && endsAt < startsAt
  const ready = key.trim() !== '' && name.trim() !== '' && !datesBackwards

  const submit = async () => {
    setBusy(true)
    setFailure(null)
    // No trigger, no spend, no created_by: 069 forces all three on insert. The
    // campaign starts with no code words on purpose — they arrive through the
    // RPC that runs the collision gate.
    const res = await createCampaign(clientId, {
      campaign_key: key.trim().toLowerCase().replace(/\s+/g, '_'),
      name: name.trim(),
      channel,
      context_text: context.trim() || null,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      active: true,
    })
    setBusy(false)
    if (!res.ok) {
      setFailure(res.code)
      return
    }
    setKey('')
    setName('')
    setContext('')
    setStartsAt('')
    setEndsAt('')
    setOpen(false)
    onCreated()
  }

  return (
    <form
      className="rounded-lg border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !busy) void submit()
      }}
    >
      <p className="text-sm font-semibold text-fg">New campaign</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Name</span>
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Short key</span>
          <Input
            className="mt-1"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="diwali_2026"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-fg-muted">Channel</span>
        <select
          className="mt-1 h-10 w-full rounded-md border border-border bg-surface-raised px-2 text-sm text-fg"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          {CAMPAIGN_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-fg-muted">What the assistant may say about it</span>
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Starts</span>
          <Input className="mt-1" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-fg-muted">Ends</span>
          <Input
            className="mt-1"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            aria-invalid={datesBackwards}
          />
        </label>
      </div>
      {datesBackwards && (
        <p className="mt-2 text-xs text-danger" role="alert">
          The end date is before the start date.
        </p>
      )}
      <HonestyNotes warnings={honestyLint(context)} />
      {failure ? <WriteFailure code={failure} /> : null}
      <p className="mt-3 text-2xs text-fg-subtle">
        Code words and spend are added after the campaign exists — each has its own check.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready || busy} loading={busy}>
          Create campaign
        </Button>
      </div>
    </form>
  )
}


/** The tenant's own WhatsApp number, for the widget link. One row, one column;
 *  `channel_accounts` is member-readable and every other column on it is engine
 *  plumbing this screen has no business showing. */
function useDisplayNumber(clientId: string | null): string | null {
  const [number, setNumber] = useState<string | null>(null)
  useEffect(() => {
    if (!clientId) return
    let live = true
    void supabase
      .from('channel_accounts')
      .select('display_number')
      .eq('client_id', clientId)
      .eq('channel', 'whatsapp')
      .limit(1)
      .then(({ data }) => {
        if (live) setNumber((data?.[0]?.display_number as string | null) ?? null)
      })
    return () => {
      live = false
    }
  }, [clientId])
  return number
}

export function CampaignsTab({ clientId, userId, names, preview }: TabProps<Campaign>) {
  const live = useCampaigns(preview ? null : clientId)
  const items = preview ?? live.items
  const displayNumber = useDisplayNumber(preview ? null : clientId)

  if (live.error && !preview) {
    return <ErrorState title="Couldn't load your campaigns." body={live.error} onRetry={live.reload} />
  }
  if (live.loading && !preview) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <NewCampaignForm clientId={clientId} onCreated={live.reload} />
      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          body="Create one to tie ad spend to the leads and sales it produced."
        />
      ) : (
        items.map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            clientId={clientId}
            userId={userId}
            names={names}
            displayNumber={displayNumber}
            onChanged={live.reload}
          />
        ))
      )}
    </div>
  )
}
