/**
 * web-shots-reporting — screenshot the S2-E2 surfaces: the owner business
 * report and the go-live checklist, as demo.client_admin.
 *
 * Same trick as web-shots.mjs: no live login. The Supabase origin and the
 * hub-service origin are both intercepted and answered from fixtures, and a
 * session is seeded into localStorage where supabase-js looks for it.
 *
 *   VITE_SUPABASE_URL=https://shots.invalid VITE_SUPABASE_ANON_KEY=x \
 *     VITE_HUB_API_BASE=https://hub.invalid npm run dev
 *   VITE_SUPABASE_URL=https://shots.invalid VITE_HUB_API_BASE=https://hub.invalid \
 *     node scripts/web-shots-reporting.mjs [outDir] [baseUrl]
 */
import { chromium } from '/Users/joyaltitus/Documents/hub-service/node_modules/playwright/index.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/ui-review/2026-09-03-reporting'))
const BASE = process.argv[3] ?? 'http://localhost:5173'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'https://shots.invalid'
const HUB = process.env.VITE_HUB_API_BASE ?? 'https://hub.invalid'

const CLIENT = 'a0de0000-0000-4000-8000-000000000001'
const USER = 'b6322df9-687a-48e2-9c49-f1dcf0b65214'
const now = Date.now()

// The S1-A demo campaign, in campaign_roi_v's shape and its MINOR units.
const ROI = [
  { campaign_id: 'cm-1', campaign_key: 'onam_2026', name: 'Onam 2026', channel: 'meta_ads', spend_minor: 4200000, conversations: 184, leads: 96, won: 14, paid_orders: 14, revenue_minor: 63000000, cost_per_lead_minor: 43750, cost_per_won_minor: 300000 },
  { campaign_id: 'cm-2', campaign_key: 'search_always_on', name: 'Search — always on', channel: 'google_ads', spend_minor: 1800000, conversations: 41, leads: 0, won: 0, paid_orders: 0, revenue_minor: 0, cost_per_lead_minor: null, cost_per_won_minor: null },
]

const METRICS = {
  ok: true,
  window: { from: '2026-08-04', to: '2026-09-02', days: 30 },
  response_time_series: [],
  volume_by_channel: [
    { date: '2026-08-31', whatsapp: 61, instagram: 12 },
    { date: '2026-09-01', whatsapp: 74, instagram: 9 },
    { date: '2026-09-02', whatsapp: 58, instagram: 14 },
  ],
  rep_stats: [],
  follow_up_compliance: { done_on_time: 94, done_late: 6, overdue: 3 },
  pipeline_stage_weighted: [
    { stage_id: 's-1', stage_key: 'qualified', label: 'Qualified', raw_value: 1240000, weight: 0.2, weighted_value: 248000 },
    { stage_id: 's-2', stage_key: 'visit', label: 'Demo / visit', raw_value: 860000, weight: 0.4, weighted_value: 344000 },
    { stage_id: 's-3', stage_key: 'proposal', label: 'Proposal', raw_value: 690000, weight: 0.6, weighted_value: 414000 },
    { stage_id: 's-4', stage_key: 'verbal', label: 'Verbal yes', raw_value: 350000, weight: 0.8, weighted_value: 280000 },
  ],
  pipeline_weighted_total: 1286000,
  objection_counts: [
    { taxonomy_key: 'price', label: 'Price / fees', count: 38 },
    { taxonomy_key: 'timing', label: 'Timing', count: 24 },
    { taxonomy_key: 'approval', label: 'Needs approval', count: 17 },
  ],
  won_by_source: [
    { source: 'meta_ads', campaign_id: 'cm-1', campaign_name: 'Onam 2026', amount: 630000, won_count: 14 },
    { source: 'walk_in', campaign_id: null, campaign_name: null, amount: 210000, won_count: 5 },
  ],
  capture_rate: null,
}

const GO_LIVE = {
  ok: true,
  client_id: CLIENT,
  auto: { blocks_activated: true, no_dangling_refs: false, persona_applied: true, profile_applied: true, scorecard_fresh: false, channel_wired: true },
  manual_acks: {
    kickoff_interview: { acked: true, note: null, acked_by: USER, acked_at: '2026-08-28T09:10:00Z' },
    persona_reviewed: { acked: true, note: null, acked_by: USER, acked_at: '2026-08-29T11:00:00Z' },
    escalation_keywords_set: { acked: true, note: null, acked_by: USER, acked_at: '2026-08-30T15:30:00Z' },
    real_device_check: { acked: false, note: null, acked_by: null, acked_at: null },
    escalation_alert_fired: { acked: false, note: null, acked_by: null, acked_at: null },
    handover_walkthrough: { acked: false, note: null, acked_by: null, acked_at: null },
  },
  ready: false,
}

const TABLES = {
  user_client_memberships: [{ role: 'client_admin', clients: { id: CLIENT, name: 'Vidya Sagar Academy', vertical: 'education' } }],
  campaign_roi_v: ROI,
  employee_targets: [
    { id: 't-1', client_id: CLIENT, user_id: 'u-1', month: '2026-09-01', target_value: 900000, incentive_per_won: 2000, bonus_at_target: 10000, created_by: USER, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
    { id: 't-2', client_id: CLIENT, user_id: 'u-2', month: '2026-09-01', target_value: 600000, incentive_per_won: 2000, bonus_at_target: 10000, created_by: USER, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
  ],
}

const RPC = { pm_go_live_check: GO_LIVE, pm_ack_go_live_item: { ok: true } }

async function stub(context) {
  await context.route(`${SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: USER, email: 'admin@example.com' } }) })
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.replace('/rest/v1/rpc/', '')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RPC[fn] ?? {}) })
    }
    const table = url.pathname.replace('/rest/v1/', '')
    const data = TABLES[table] ?? []
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const payload = single ? (Array.isArray(data) ? (data[0] ?? null) : data) : Array.isArray(data) ? data : [data]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  // hub-service. GET /api/metrics is the only call these two screens make.
  await context.route(`${HUB}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/metrics') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(METRICS) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

/** No horizontal scroll at any width is a hard rule (§C); assert it rather than
 *  trusting the eye on a screenshot. */
async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement
    return el.scrollWidth - el.clientWidth
  })
  if (overflow > 1) throw new Error(`horizontal scroll of ${overflow}px at ${label}`)
}

async function shoot(page, name, theme, width) {
  await page.waitForTimeout(400)
  await assertNoHorizontalScroll(page, `${name}-${width}-${theme}`)
  await page.screenshot({ path: path.join(OUT, `${name}-${width}-${theme}.png`), fullPage: true })
  process.stdout.write(`  ✓ ${name}-${width}-${theme}.png\n`)
}

async function run() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const ref = new URL(SUPABASE).hostname.split('.')[0]

  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const browser = await chromium.launch()
      const context = await browser.newContext({ colorScheme: theme, viewport: { width, height: width === 390 ? 844 : 900 } })
      await stub(context)
      await context.addInitScript(([ref, user, client, expires]) => {
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
          access_token: 'stub', refresh_token: 'stub', token_type: 'bearer',
          expires_at: expires, expires_in: 3600, user: { id: user, email: 'admin@example.com' },
        }))
        localStorage.setItem('sales-app.activeClientId', client)
        localStorage.setItem('sales-app.theme', 'system')
        // hubFetch refuses before the network without one.
        localStorage.setItem('sales-app.pmGatewayKey', 'stub-key')
      }, [ref, USER, CLIENT, Math.floor(now / 1000) + 3600])

      const page = await context.newPage()
      page.on('pageerror', (e) => process.stderr.write(`  ! pageerror: ${e.message}\n`))

      await page.goto(`${BASE}/admin/dashboard?view=report`)
      await page.waitForSelector('text=The business, at a glance.', { timeout: 20000 })
      await page.waitForSelector('text=Return on spend')
      await shoot(page, '01-owner-report', theme, width)

      await page.goto(`${BASE}/admin/go-live`)
      await page.waitForSelector('text=Ready to go live', { timeout: 20000 })
      await shoot(page, '02-go-live', theme, width)

      await context.close()
      await browser.close()
    }
  }
  process.stdout.write(`\nWrote ${OUT}\n`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
