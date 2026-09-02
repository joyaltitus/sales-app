import { useEffect, useState } from 'react'
import { Lock, Store } from 'lucide-react'
import {
  useProfile,
  saveProfileDraft,
  applyProfileDraft,
  honestyLint,
  PROFILE_FIELDS,
} from '../../lib/manage-data'
import type { Profile, ProfileDraft } from '../../lib/manage-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Input } from '../../ui/Input'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { HistoryButton, HistoryDrawer } from './HistoryDrawer'
import { HonestyNotes, WriteFailure } from './shared'

// Business profile — the singleton, and the one surface here that is draft →
// apply rather than live-with-history (§G.2 rail 6).
//
// The asymmetry is deliberate and was decided rather than defaulted: a price
// edit behind a two-step apply flow kills the self-serve win, so row tables go
// live immediately with history behind them. But there is exactly ONE greeting,
// it is the first thing every customer reads, and a half-finished edit to it is
// visible to everyone until it is finished. So this one stages.
//
// `escalation_keywords` is rendered read-only: it is the routing lexicon that
// decides whether a customer reaches a human. Editing it is an operator action,
// and pm_lint_keywords grades a collision with it as `block` everywhere else in
// this view for the same reason.

const FIELD_LABEL: Record<keyof ProfileDraft, { label: string; hint: string; long?: boolean }> = {
  greeting_message: {
    label: 'Greeting',
    hint: 'The first thing a new customer reads.',
    long: true,
  },
  fallback_message: {
    label: 'Fallback',
    hint: 'Sent when the assistant has no confident answer.',
    long: true,
  },
  escalation_contact: { label: 'Escalation contact', hint: 'Who a handover reaches.' },
  location_text: { label: 'Location', hint: 'Stated as-is when someone asks where you are.' },
  payment_text: { label: 'Payment terms', hint: 'Stated as-is when someone asks how to pay.' },
}

function toDraft(source: ProfileDraft): ProfileDraft {
  return {
    greeting_message: source.greeting_message ?? null,
    fallback_message: source.fallback_message ?? null,
    escalation_contact: source.escalation_contact ?? null,
    location_text: source.location_text ?? null,
    payment_text: source.payment_text ?? null,
  }
}

function ProfileForm({
  profile,
  clientId,
  userId,
  names,
  onChanged,
  readOnly,
}: {
  profile: Profile
  clientId: string
  userId: string | null
  names: Map<string, string>
  onChanged: () => void
  readOnly: boolean
}) {
  // A saved draft is what the operator was last working on, so it wins over the
  // live values on load — resuming beats restarting.
  const [values, setValues] = useState<ProfileDraft>(() => toDraft(profile.draft ?? profile))
  const [busy, setBusy] = useState<'draft' | 'apply' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    setValues(toDraft(profile.draft ?? profile))
  }, [profile])

  const live = toDraft(profile)
  const dirty = PROFILE_FIELDS.some((f) => (values[f] ?? '') !== (live[f] ?? ''))
  const warnings = [
    ...honestyLint(values.greeting_message),
    ...honestyLint(values.fallback_message),
  ]

  const run = async (mode: 'draft' | 'apply') => {
    if (readOnly) return
    setBusy(mode)
    setFailure(null)
    const fn = mode === 'draft' ? saveProfileDraft : applyProfileDraft
    const res = await fn(clientId, profile.id, values)
    setBusy(null)
    if (res.ok) onChanged()
    else setFailure(res.code)
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="label-caps">What your assistant says about you</p>
        {profile.draft ? <Chip tone="warn">Unpublished draft</Chip> : null}
        <div className="ml-auto">
          <HistoryButton onClick={() => setHistoryOpen(true)} />
        </div>
      </div>

      {PROFILE_FIELDS.map((field) => {
        const meta = FIELD_LABEL[field]
        return (
          <label key={field} className="mt-3 block">
            <span className="label-caps">{meta.label}</span>
            {meta.long ? (
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg"
                value={values[field] ?? ''}
                readOnly={readOnly}
                onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
              />
            ) : (
              <Input
                className="mt-1"
                value={values[field] ?? ''}
                readOnly={readOnly}
                onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
              />
            )}
            <span className="mt-1 block text-2xs text-fg-subtle">{meta.hint}</span>
          </label>
        )
      })}

      <div className="mt-4 rounded-md border border-border bg-surface-sunk p-3">
        <p className="label-caps flex items-center gap-1.5 text-fg-subtle">
          <Lock aria-hidden size={11} /> Handover words
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {profile.escalation_keywords.map((k) => (
            <Chip key={k} tone="neutral">
              {k}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-2xs leading-relaxed text-fg-muted">
          When a customer says one of these, the assistant stops and hands over to a person. We
          keep this list — ask us to change it.
        </p>
      </div>

      <HonestyNotes warnings={warnings} />
      {failure ? <WriteFailure code={failure} /> : null}

      {/* Rendered even in preview, so the gallery shows the draft → publish
          design. The inputs are readOnly there, so nothing is ever dirty and
          both buttons stay inert without a second disabled flag. */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-2xs text-fg-subtle">
          Saving a draft changes nothing customers see. Publishing does.
        </span>
        <Button
          variant="secondary"
          disabled={!dirty || busy !== null}
          loading={busy === 'draft'}
          onClick={() => void run('draft')}
        >
          Save draft
        </Button>
        <Button
          disabled={!dirty || busy !== null}
          loading={busy === 'apply'}
          onClick={() => void run('apply')}
        >
          Publish
        </Button>
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        clientId={clientId}
        userId={userId}
        tableName="business_profile"
        recordPk={profile.id}
        title="Business profile"
        names={names}
        onReverted={onChanged}
      />
    </div>
  )
}

export function ProfileTab({
  clientId,
  userId,
  names,
  preview,
}: {
  clientId: string
  userId: string | null
  names: Map<string, string>
  preview?: Profile
}) {
  const live = useProfile(preview ? null : clientId)
  const profile = preview ?? live.item

  if (live.error && !preview) {
    return <ErrorState title="Couldn't load your profile." body={live.error} onRetry={live.reload} />
  }
  if (live.loading && !preview) return <Skeleton className="h-96 w-full" />
  if (!profile) {
    return (
      <EmptyState
        icon={Store}
        title="No profile yet"
        body="Your business profile is created during onboarding. Ask us if it is missing."
      />
    )
  }

  return (
    <ProfileForm
      profile={profile}
      clientId={clientId}
      userId={userId}
      names={names}
      onChanged={live.reload}
      readOnly={Boolean(preview)}
    />
  )
}
