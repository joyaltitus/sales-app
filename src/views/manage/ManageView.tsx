import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClient } from '../../shell/ClientProvider'
import { useAuth } from '../../auth/AuthProvider'
import { useTeam } from '../../lib/team-data'
import { useConfigStaleness } from '../../lib/manage-data'
import type { Campaign, Faq, Product, Profile, Rule, Staleness } from '../../lib/manage-data'
import type { IntakeSource } from './LeadSources'
import type { ImportBatch } from './Import'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ProductsTab } from './ProductsTab'
import { FaqsTab } from './FaqsTab'
import { ProfileTab } from './ProfileTab'
import { RulesTab } from './RulesTab'
import { CampaignsTab } from './CampaignsTab'
import { LeadSources } from './LeadSources'
import { Import } from './Import'

// AT-29 — the client_admin's configuration surface.
//
// AdminShell only, and the reason is a policy rather than a preference: 069's
// `campaigns_write` is client_admin, and the two campaign RPCs wall on
// has_role(client_admin). A manager opening this view would get a screen whose
// every write comes back `forbidden`, so the shells do not paint the link.
//
// Plain language throughout, never engine jargon ("Your products", "Your
// answers"). The person using this is the business owner, not the operator who
// built their configuration.

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'faqs', label: 'Answers' },
  { key: 'profile', label: 'Profile' },
  { key: 'replies', label: 'Objection replies' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'sources', label: 'Lead sources' },
  { key: 'import', label: 'Import' },
] as const

type TabKey = (typeof TABS)[number]['key']
const VALID = new Set<string>(TABS.map((t) => t.key))

/** The badge is a claim about verification, so it says nothing when it does not
 *  know. `unknown` covers both "never scored" and "the status endpoint did not
 *  answer" — neither is a verdict, and painting a green badge on a failed
 *  lookup would be the one outcome worse than no badge at all. */
function StalenessBadge({ state }: { state: Staleness }) {
  if (state.kind === 'unknown') return null
  if (state.kind === 'fresh') {
    return <Chip tone="success">Checked against this setup</Chip>
  }
  return (
    <Chip tone="warn">
      Setup changed since the last check
      {state.scoredAt ? ` (${new Date(state.scoredAt).toLocaleDateString()})` : ''}
    </Chip>
  )
}

export type ManageDesignData = {
  products?: Product[]
  faqs?: Faq[]
  profile?: Profile
  rules?: Rule[]
  campaigns?: Campaign[]
  sources?: IntakeSource[]
  imports?: ImportBatch[]
  tab?: TabKey
  clientName?: string
}

/** `designData` feeds the design gallery fixed rows with no session and no
 *  network: every hook below is called with `null` and the passed rows render
 *  instead. It never affects the signed-in path. Same shape as TeamPage's. */
export function ManageView({ designData }: { designData?: ManageDesignData } = {}) {
  const { activeClient } = useClient()
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [designTab, setDesignTab] = useState<TabKey>(designData?.tab ?? 'products')

  const clientId = designData ? 'design-client' : (activeClient?.id ?? null)
  const userId = designData ? 'design-user' : (session?.user?.id ?? null)

  // The roster is already a tenant-scoped bounded read; reusing it gives the
  // history drawer real names instead of uuids.
  const { items: team } = useTeam(designData ? null : clientId)
  const names = useMemo(
    () => new Map(team.filter((m) => m.display_name).map((m) => [m.user_id, m.display_name as string])),
    [team],
  )
  const { state: staleness } = useConfigStaleness(designData ? null : clientId)

  const raw = searchParams.get('tab')
  const tab: TabKey = designData
    ? designTab
    : raw && VALID.has(raw)
      ? (raw as TabKey)
      : 'products'

  const setTab = (next: TabKey) => {
    if (designData) {
      setDesignTab(next)
      return
    }
    const params = new URLSearchParams(searchParams)
    if (next === 'products') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  if (!clientId) {
    return <EmptyState title="No workspace" body="Pick a workspace to manage its setup." />
  }

  const tabProps = { clientId, userId, names }

  return (
    <div className="space-y-4 p-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-fg">Setup</h1>
          <StalenessBadge state={designData ? { kind: 'unknown' } : staleness} />
        </div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-muted">
          What your assistant sells, says and knows. Every change here is recorded and can be put
          back — open History on any row.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-sunk p-1" role="tablist" aria-label="Setup section">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={[
              'min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors',
              tab === t.key ? 'bg-surface text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab {...tabProps} preview={designData?.products} />}
      {tab === 'faqs' && <FaqsTab {...tabProps} preview={designData?.faqs} />}
      {tab === 'profile' && <ProfileTab {...tabProps} preview={designData?.profile} />}
      {tab === 'replies' && <RulesTab {...tabProps} preview={designData?.rules} />}
      {tab === 'campaigns' && <CampaignsTab {...tabProps} preview={designData?.campaigns} />}
      {tab === 'sources' && <LeadSources {...tabProps} preview={designData?.sources} />}
      {tab === 'import' && <Import {...tabProps} preview={designData?.imports} />}
    </div>
  )
}
