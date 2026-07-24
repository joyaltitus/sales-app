import { supabase } from '../../lib/supabase'

// Onboarding console data layer (ONB §D screen 1). Read-only in v1: progress
// is DERIVED from the DB (row counts + M1 ledger tables), never localStorage.
// Anon key + RLS only (law 8) — writes stay on the pm_* RPC lanes (CON-01b).

// The 9 content blocks (ONB §B AUTHORING row → tables).
export type BlockKind = 'rows' | 'rows-no-active' | 'singleton'

export type BlockDef = {
  key: string
  label: string
  table: string
  kind: BlockKind
}

export const BLOCKS: BlockDef[] = [
  { key: 'items', label: 'Items & pricing', table: 'items', kind: 'rows' },
  { key: 'lead_stages', label: 'Lead stages', table: 'lead_stages', kind: 'rows' },
  { key: 'knowledge', label: 'Knowledge', table: 'knowledge_entries', kind: 'rows' },
  { key: 'media_bundles', label: 'Media bundles', table: 'media_bundles', kind: 'rows-no-active' },
  { key: 'rules', label: 'Playbook rules', table: 'playbook_rules', kind: 'rows' },
  { key: 'persona', label: 'Persona', table: 'personas', kind: 'singleton' },
  { key: 'profile', label: 'Business profile', table: 'business_profile', kind: 'singleton' },
  { key: 'campaigns', label: 'Campaigns', table: 'campaigns', kind: 'rows' },
  { key: 'sequences', label: 'Sequences', table: 'sequences', kind: 'rows' },
]

export type BlockProgress = {
  def: BlockDef
  live: number // active rows (or 1 if the singleton is compiled/filled)
  staged: number // imported-but-inactive rows, or 1 if a draft is pending
  lastChange: string | null // latest record_revisions.created_at for the table
}

export type ScorecardTile = {
  packageKey: string
  verdict: string | null
  configHash: string
  finishedAt: string | null
  createdAt: string
} | null

export type OnboardingProgress = {
  blocks: BlockProgress[]
  liveBlocks: number // blocks with live > 0, out of BLOCKS.length
  scorecard: ScorecardTile
}

async function countRows(
  table: string,
  clientId: string,
  activeFilter?: boolean,
): Promise<number> {
  let q = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
  if (activeFilter !== undefined) q = q.eq('active', activeFilter)
  const { count, error } = await q
  if (error) throw new Error(`count ${table}: ${error.message}`)
  return count ?? 0
}

async function singletonState(
  table: 'personas' | 'business_profile',
  clientId: string,
): Promise<{ live: number; staged: number }> {
  const liveCol = table === 'personas' ? 'compiled_prompt' : 'greeting_message'
  const { data, error } = await supabase
    .from(table)
    .select(`${liveCol}, draft`)
    .eq('client_id', clientId)
    .limit(1)
  if (error) throw new Error(`read ${table}: ${error.message}`)
  const row = data?.[0] as Record<string, unknown> | undefined
  return {
    live: row?.[liveCol] ? 1 : 0,
    staged: row?.draft ? 1 : 0,
  }
}

// Latest revision timestamp per table from the M1 ledger (migration 037).
async function lastChangeByTable(clientId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('record_revisions')
    .select('table_name, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`record_revisions: ${error.message}`)
  const latest = new Map<string, string>()
  for (const r of data ?? []) {
    if (!latest.has(r.table_name)) latest.set(r.table_name, r.created_at)
  }
  return latest
}

async function latestScorecard(clientId: string): Promise<ScorecardTile> {
  const { data, error } = await supabase
    .from('test_runs')
    .select('package_key, verdict, config_hash, finished_at, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`test_runs: ${error.message}`)
  const r = data?.[0]
  if (!r) return null
  return {
    packageKey: r.package_key,
    verdict: r.verdict,
    configHash: r.config_hash,
    finishedAt: r.finished_at,
    createdAt: r.created_at,
  }
}

export async function fetchOnboardingProgress(
  clientId: string,
): Promise<OnboardingProgress> {
  const [revisions, scorecard, ...blockStates] = await Promise.all([
    lastChangeByTable(clientId),
    latestScorecard(clientId),
    ...BLOCKS.map(async (def) => {
      if (def.kind === 'singleton') {
        return singletonState(def.table as 'personas' | 'business_profile', clientId)
      }
      if (def.kind === 'rows-no-active') {
        const live = await countRows(def.table, clientId)
        return { live, staged: 0 }
      }
      const [live, staged] = await Promise.all([
        countRows(def.table, clientId, true),
        countRows(def.table, clientId, false),
      ])
      return { live, staged }
    }),
  ])

  const blocks: BlockProgress[] = BLOCKS.map((def, i) => ({
    def,
    live: blockStates[i].live,
    staged: blockStates[i].staged,
    lastChange: revisions.get(def.table) ?? null,
  }))

  return {
    blocks,
    liveBlocks: blocks.filter((b) => b.live > 0).length,
    scorecard,
  }
}

export function relTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
