import { useState } from 'react'
import { Radar, TrendingUp } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import {
  useCampaignRoi,
  useSightings,
  resolveSighting,
  dismissSighting,
} from '../../lib/attribution-data'
import type { CampaignRoi, Sighting } from '../../lib/attribution-data'
import { formatINR } from '../../ui/formatMoney'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { WriteFailure } from '../manage/shared'

// AT-30 — what the money bought, and what we could not place.
//
// Mounted by AdminShell and ManagerShell. Reps get no link, and the reason is
// `campaign_roi_v` itself: 070 put a has_role(manager|client_admin) guard INSIDE
// the view, so an agent gets no rows rather than rows with a blank revenue
// column. The rail simply does not paint a door their data could not fill.

/** Minor units at the edge, once. NULL is not zero: 070 returns NULL rather
 *  than dividing by zero, so "no leads yet" must read as unknown — a cost per
 *  lead of ₹0 on a campaign that produced nothing is the exact wrong story. */
function money(minor: number | null): string {
  if (minor === null || minor === undefined) return '—'
  return formatINR(minor / 100)
}

function RoiTable({ rows }: { rows: CampaignRoi[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="label-caps px-3 py-2">Campaign</th>
            <th scope="col" className="label-caps px-3 py-2 text-right">Spend</th>
            <th scope="col" className="label-caps px-3 py-2 text-right">Leads</th>
            <th scope="col" className="label-caps px-3 py-2 text-right">Won</th>
            <th scope="col" className="label-caps px-3 py-2 text-right">Revenue</th>
            <th scope="col" className="label-caps px-3 py-2 text-right">Cost / lead</th>
            <th scope="col" className="label-caps px-3 py-2 text-right">Cost / sale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaign_id} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-3 py-2.5 text-left font-medium text-fg">
                <span className="block">{r.name}</span>
                <Chip tone="neutral">{r.channel}</Chip>
              </th>
              <td className="tnum px-3 py-2.5 text-right text-fg">{money(r.spend_minor)}</td>
              <td className="tnum px-3 py-2.5 text-right text-fg">{r.leads}</td>
              <td className="tnum px-3 py-2.5 text-right text-fg">{r.won}</td>
              <td className="tnum px-3 py-2.5 text-right text-fg">{money(r.revenue_minor)}</td>
              <td className="tnum px-3 py-2.5 text-right text-fg-muted">{money(r.cost_per_lead_minor)}</td>
              <td className="tnum px-3 py-2.5 text-right text-fg-muted">{money(r.cost_per_won_minor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SightingRow({
  sighting,
  campaigns,
  clientId,
  onChanged,
}: {
  sighting: Sighting
  campaigns: CampaignRoi[]
  clientId: string
  onChanged: () => void
}) {
  const [campaignId, setCampaignId] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const act = async (fn: () => Promise<{ ok: boolean; code?: string }>) => {
    setBusy(true)
    setFailure(null)
    const res = await fn()
    setBusy(false)
    if (res.ok) onChanged()
    else setFailure(res.code ?? 'refused')
  }

  return (
    <li className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-fg">{sighting.source_value}</span>
        <Chip tone="neutral">{sighting.source_kind}</Chip>
        <span className="text-2xs text-fg-subtle">
          seen {sighting.hit_count} time{sighting.hit_count === 1 ? '' : 's'}, last{' '}
          <time dateTime={sighting.last_seen_at}>
            {new Date(sighting.last_seen_at).toLocaleDateString()}
          </time>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`sighting-${sighting.id}`}>
          Campaign for {sighting.source_value}
        </label>
        <select
          id={`sighting-${sighting.id}`}
          className="h-9 rounded-md border border-border bg-surface-raised px-2 text-xs text-fg"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">Pick a campaign…</option>
          {campaigns.map((c) => (
            <option key={c.campaign_id} value={c.campaign_id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!campaignId || busy}
          loading={busy}
          onClick={() => void act(() => resolveSighting(clientId, sighting.id, campaignId))}
        >
          Resolve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void act(() => dismissSighting(clientId, sighting.id))}
        >
          Not ours
        </Button>
      </div>
      {failure ? <WriteFailure code={failure} /> : null}
    </li>
  )
}

export type AttributionPreview = { roi?: CampaignRoi[]; sightings?: Sighting[] }

export function AttributionView({ preview }: { preview?: AttributionPreview } = {}) {
  const { activeClient } = useClient()
  const clientId = preview ? 'preview-client' : (activeClient?.id ?? null)
  const roi = useCampaignRoi(preview ? null : clientId)
  const sightings = useSightings(preview ? null : clientId)

  const roiRows = preview?.roi ?? roi.items
  const sightingRows = preview?.sightings ?? sightings.items

  if (!clientId) {
    return <EmptyState title="No workspace" body="Pick a workspace to see its campaigns." />
  }

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="text-lg font-semibold text-fg">Attribution</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-muted">
          What each campaign cost and what it brought back. A dash means we do not know yet — not
          that the answer is zero.
        </p>
      </header>

      <section>
        <h2 className="label-caps mb-2 flex items-center gap-1.5">
          <TrendingUp aria-hidden size={13} /> Return on spend
        </h2>
        {roi.error && !preview ? (
          <ErrorState title="Couldn't load campaign returns." body={roi.error} onRetry={roi.reload} />
        ) : roi.loading && !preview ? (
          <Skeleton className="h-48 w-full" />
        ) : roiRows.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No campaigns yet"
            body="Once a campaign exists and has spend against it, its return shows here."
          />
        ) : (
          <RoiTable rows={roiRows} />
        )}
      </section>

      <section>
        <h2 className="label-caps mb-2 flex items-center gap-1.5">
          <Radar aria-hidden size={13} /> Sources we could not place
        </h2>
        <p className="mb-2 max-w-2xl text-xs leading-relaxed text-fg-muted">
          Ads that sent us customers but matched no campaign. Resolving one records which campaign
          it belonged to; to make future traffic land there too, add the id to that campaign's ad
          source ids under Your setup.
        </p>
        {sightings.error && !preview ? (
          <ErrorState
            title="Couldn't load unmatched sources."
            body={sightings.error}
            onRetry={sightings.reload}
          />
        ) : sightings.loading && !preview ? (
          <Skeleton className="h-32 w-full" />
        ) : sightingRows.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="Nothing unmatched"
            body="Every ad source that reached you is already tied to a campaign."
          />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {sightingRows.map((s) => (
              <SightingRow
                key={s.id}
                sighting={s}
                campaigns={roiRows}
                clientId={clientId}
                onChanged={sightings.reload}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
