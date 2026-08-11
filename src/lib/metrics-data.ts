import { useEffect, useState } from 'react'
import { hubFetch, type HubResult } from './api'

// WIRE-B2/S10 — hub-service GET /api/metrics client. Hand-copied response shape
// (no shared package between the two repos — same convention as api.ts's `Insight`
// type for /api/insights). Source of truth: hub-service src/api/metrics.ts, commit
// a53a589 (PR #103, WIRE-B2/S10).
export const METRICS_PATH = '/api/metrics'

export type ResponseTimePoint = { date: string; median_minutes: number | null }
export type ChannelVolumePoint = { date: string; whatsapp: number; instagram: number }
export type RepStat = {
  user_id: string
  name: string
  replies: number
  median_reply_minutes: number | null
  won: number
}
export type FollowUpCompliance = { done_on_time: number; done_late: number; overdue: number }
export type PipelineStageWeighted = {
  stage_id: string
  stage_key: string
  label: string
  raw_value: number
  weight: number
  weighted_value: number
}
export type ObjectionCount = { taxonomy_key: string; label: string; count: number }
export type WonBySource = {
  source: string
  campaign_id: string | null
  campaign_name: string | null
  amount: number
  won_count: number
}
export type CaptureRateRow = {
  user_id: string
  name: string
  objection_count: number
  assigned_with_inbound: number
  capture_rate_pct: number | null
}
export type CaptureRate = { rule_version: 'h4v1'; rows: CaptureRateRow[] }

export type MetricsResponse = {
  ok: boolean
  window: { from: string; to: string; days: number }
  response_time_series: ResponseTimePoint[]
  volume_by_channel: ChannelVolumePoint[]
  rep_stats: RepStat[]
  follow_up_compliance: FollowUpCompliance
  pipeline_stage_weighted: PipelineStageWeighted[]
  pipeline_weighted_total: number
  /** manager/client_admin/super_admin only — null (not omitted) for an agent caller. */
  objection_counts: ObjectionCount[] | null
  won_by_source: WonBySource[] | null
  capture_rate: CaptureRate | null
}

export type MetricsWindow = '7d' | '14d' | '30d'

export function fetchMetrics(
  window: MetricsWindow = '14d',
  clientId: string | null = null,
): Promise<HubResult<MetricsResponse>> {
  const clientParam = clientId ? `&client_id=${encodeURIComponent(clientId)}` : ''
  return hubFetch<MetricsResponse>(`${METRICS_PATH}?window=${window}${clientParam}`)
}

/** One fetch per (window, clientId) change — no interval, no polling, no
 *  refetch-on-focus. A dashboard visit issues exactly one request; a period
 *  toggle issues exactly one more. clientId disambiguates a manager who
 *  belongs to more than one client (hub-service otherwise 400s
 *  'ambiguous_client' — see src/api/auth.ts resolveClientMemberContext). */
export function useMetrics(window: MetricsWindow = '14d', clientId: string | null = null) {
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<HubResult<MetricsResponse> | null>(null)

  useEffect(() => {
    if (!clientId) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMetrics(window, clientId).then((res) => {
      if (cancelled) return
      if (res.kind === 'ok') setData(res.data)
      else setError(res)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [window, clientId])

  return { data, loading, error }
}
