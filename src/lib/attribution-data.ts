import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Attribution (AT-30) — spend against what it actually bought, plus the inbox of
// ad sources the matcher could not place.
//
// `campaign_roi_v` (070) is `security_invoker` with a `has_role(manager|
// client_admin)` guard inside it, so an agent gets no rows rather than rows
// with a blank revenue column. That is the wall; the shells simply do not paint
// a link a rep's data could not fill.
//
// Money arrives as MINOR units (bigint paise) all the way from payment_orders,
// and stays that way through this module. Dividing by 100 for display is the
// view's job, done once, at the edge — a float here would be a rounding error
// with a currency symbol on it.
const ROI_LIMIT = 200
const SIGHTING_LIMIT = 100

export type CampaignRoi = {
  campaign_id: string
  campaign_key: string
  name: string
  channel: string
  spend_minor: number
  conversations: number
  leads: number
  won: number
  paid_orders: number
  revenue_minor: number
  /** NULL when the denominator is zero — 070 returns unknown rather than
   *  dividing, so "no leads yet" reads as unknown, not as a cost of zero. */
  cost_per_lead_minor: number | null
  cost_per_won_minor: number | null
}

export function useCampaignRoi(clientId: string | null) {
  const [items, setItems] = useState<CampaignRoi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('campaign_roi_v')
      .select(
        'campaign_id, campaign_key, name, channel, spend_minor, conversations, leads, won, paid_orders, revenue_minor, cost_per_lead_minor, cost_per_won_minor',
      )
      .eq('client_id', clientId)
      .order('spend_minor', { ascending: false })
      .limit(ROI_LIMIT)
    if (err) {
      setItems([])
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as CampaignRoi[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

export type Sighting = {
  id: string
  source_kind: 'ctwa' | 'code'
  source_value: string
  hit_count: number
  first_seen_at: string
  last_seen_at: string
}

/** The unattributed-source inbox: every ad source that reached us and matched no
 *  active campaign trigger. Only open rows — a resolved or dismissed sighting is
 *  answered, and 062 indexes exactly this predicate. */
export function useSightings(clientId: string | null) {
  const [items, setItems] = useState<Sighting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('campaign_source_sightings')
      .select('id, source_kind, source_value, hit_count, first_seen_at, last_seen_at')
      .eq('client_id', clientId)
      .is('resolved_campaign_id', null)
      .is('dismissed_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(SIGHTING_LIMIT)
    if (err) {
      setItems([])
      setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as Sighting[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, error, reload: load }
}

export type SightingResult = { ok: true } | { ok: false; code: string }

function fromWrite(
  data: unknown[] | null,
  error: { message: string } | null,
): SightingResult {
  if (error) return { ok: false, code: 'write_failed' }
  // RLS refuses by returning no rows, not by erroring. An UPDATE that matched
  // nothing is a denial, and reporting it as success would be a lie the
  // operator finds out about later.
  if (!data || data.length === 0) return { ok: false, code: 'denied' }
  return { ok: true }
}

/**
 * Resolve a sighting to a campaign — 069 moved this write from client_admin|
 * agent to manager|client_admin, because an agent re-pointing traffic silently
 * rewrites ROI.
 *
 * ⚠ This sets the sighting's OWN `resolved_campaign_id`; it does not re-point
 * past conversations. Nothing in the schema links a sighting to the
 * conversations that produced it — `conversations` stores `ctwa_clid` (the
 * per-click id) and never the ad `source_id` a sighting is keyed by — so the
 * retro-attribution `pm_set_conversation_campaign` performs cannot be derived
 * from this row. To make FUTURE traffic land on the campaign, the source value
 * goes into that campaign's `ctwa_source_ids` on the Campaigns tab, which is
 * the one place the collision gate runs.
 */
export async function resolveSighting(
  clientId: string,
  sightingId: string,
  campaignId: string,
): Promise<SightingResult> {
  const { data, error } = await supabase
    .from('campaign_source_sightings')
    .update({ resolved_campaign_id: campaignId })
    .eq('client_id', clientId)
    .eq('id', sightingId)
    .select('id')
  return fromWrite(data, error)
}

/** Dismiss — the source is real but is not ours to attribute. Not a delete: the
 *  row stays, so the same ad id arriving again is visibly a thing already
 *  judged rather than a fresh mystery. */
export async function dismissSighting(
  clientId: string,
  sightingId: string,
): Promise<SightingResult> {
  const { data, error } = await supabase
    .from('campaign_source_sightings')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('id', sightingId)
    .select('id')
  return fromWrite(data, error)
}
