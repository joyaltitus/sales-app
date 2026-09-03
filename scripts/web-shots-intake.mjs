/**
 * web-shots-intake — screenshot the S2-G surfaces: Lead sources, Import and the
 * campaign website widget, as demo.client_admin.
 *
 * Same trick as web-shots-reporting.mjs: no live login. The Supabase origin and
 * the hub-service origin are both intercepted and answered from fixtures, and a
 * session is seeded into localStorage where supabase-js looks for it.
 *
 *   VITE_SUPABASE_URL=https://shots.invalid VITE_SUPABASE_ANON_KEY=x \
 *     VITE_HUB_API_BASE=https://hub.invalid npm run dev
 *   VITE_SUPABASE_URL=https://shots.invalid VITE_HUB_API_BASE=https://hub.invalid \
 *     node scripts/web-shots-intake.mjs [outDir] [baseUrl]
 *
 * Pass `empty` as the third argument to answer every table with zero rows. That
 * pass is the mock detector: any content still on screen against an empty tenant
 * is hardcoded in the component, which is exactly how #59's mock data survived a
 * CHANGES list and a grep.
 */
import { chromium } from '/Users/joyaltitus/Documents/hub-service/node_modules/playwright/index.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/ui-review/2026-09-03-intake'))
const BASE = process.argv[3] ?? 'http://localhost:5173'
const EMPTY = process.argv[4] === 'empty'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'https://shots.invalid'
const HUB = process.env.VITE_HUB_API_BASE ?? 'https://hub.invalid'

const CLIENT = 'a0de0000-0000-4000-8000-000000000001'
const USER = 'b6322df9-687a-48e2-9c49-f1dcf0b65214'
const now = Date.now()
const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString()

const FULL = {
  user_client_memberships: [
    { role: 'client_admin', clients: { id: CLIENT, name: 'Vidya Sagar Academy', vertical: 'education' } },
  ],
  channel_accounts: [{ display_number: '+91 98470 12345' }],
  // 077's shape. The form source is one field short of live, so the shot shows
  // the state an operator actually meets rather than a finished one.
  intake_source_configs: [
    {
      id: 'cc10d5db-0000-4000-8000-000000000001',
      source_key: 'site_form',
      display_name: 'Website enquiry form',
      mode: 'sandbox',
      active: false,
      key_last4: '',
      key_rotated_at: null,
      phone_field_path: 'phone',
      first_touch_template_id: null,
      daily_first_touch_cap: 50,
      owner_pool: [USER],
      door: 'form',
      slug: 'vidya-sagar-demo',
    },
    {
      id: 'cc10d5db-0000-4000-8000-000000000002',
      source_key: 'indiamart',
      display_name: 'IndiaMART enquiries',
      mode: 'live',
      active: true,
      key_last4: '9f2c',
      key_rotated_at: iso(-11 * 864e5),
      phone_field_path: 'SENDER_MOBILE',
      first_touch_template_id: 'tpl-1',
      daily_first_touch_cap: 200,
      owner_pool: [USER],
      door: 'api',
      slug: null,
    },
  ],
  // 078's shape: one cohort still blocked, one lifted, one that needs a remap.
  import_batches: [
    {
      id: '7f3c9a10-0000-4000-8000-000000000009',
      filename: 'past-students-2024.csv',
      status: 'committed',
      counts: { rows: 20, new: 15, dup_in_file: 1, dup_existing: 2, invalid: 2 },
      consent: { provenance: 'past_customers' },
      messaging_mode: 'do_not_message',
      stage_failed: null,
      created_at: iso(-2 * 3600e3),
    },
    {
      id: '4a11c0de-0000-4000-8000-000000000004',
      filename: 'enquiries-august.csv',
      status: 'committed',
      counts: { rows: 312, new: 288, dup_in_file: 9, dup_existing: 12, invalid: 3 },
      consent: { provenance: 'prior_enquiries', attestation: 'Enquiry forms on file.' },
      messaging_mode: 'allowed',
      stage_failed: null,
      created_at: iso(-6 * 864e5),
    },
    {
      id: '90bad900-0000-4000-8000-000000000002',
      filename: 'old-register.csv',
      status: 'awaiting_mapping',
      counts: { rows: 40, new: 4, dup_in_file: 0, dup_existing: 0, invalid: 36, blocked: 'invalid_ratio' },
      consent: { provenance: 'past_customers' },
      messaging_mode: 'do_not_message',
      stage_failed: null,
      created_at: iso(-30 * 60e3),
    },
  ],
  campaigns: [
    {
      id: 'cm-1',
      campaign_key: 'onam_2026',
      name: 'Onam 2026',
      channel: 'meta_ads',
      context_text: 'Onam admissions window, ₹5,000 off the first instalment until 20 September.',
      starts_at: '2026-08-25',
      ends_at: '2026-09-20',
      active: true,
      spend_minor: 4200000,
      trigger: { code_keywords: ['onam'], ctwa_source_ids: [] },
    },
  ],
  items: [],
  knowledge_blocks: [],
  playbook_rules: [],
  media_bundles: [],
  business_profile: [],
  config_revisions: [],
  user_profiles: [{ user_id: USER, display_name: 'Asha Menon' }],
  memberships: [],
}

const TABLES = EMPTY
  ? { user_client_memberships: FULL.user_client_memberships }
  : FULL

async function stub(context) {
  await context.route(`${SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: USER, email: 'admin@example.com' } }) })
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
    const table = url.pathname.replace('/rest/v1/', '')
    const data = TABLES[table] ?? []
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const payload = single ? (Array.isArray(data) ? (data[0] ?? null) : data) : Array.isArray(data) ? data : [data]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  // Nothing on these screens READS from hub-service — every write does. A 200
  // keeps a stray call from painting an error state in a shot.
  await context.route(`${HUB}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}

/** No horizontal scroll at any width is a hard rule (§C); assert it rather than
 *  trusting the eye on a screenshot. The snippet boxes are the risk here: a
 *  <pre> of a curl line is exactly what pushes a phone layout sideways. */
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
        localStorage.setItem('sales-app.pmGatewayKey', 'stub-key')
      }, [ref, USER, CLIENT, Math.floor(now / 1000) + 3600])

      const page = await context.newPage()
      page.on('pageerror', (e) => process.stderr.write(`  ! pageerror: ${e.message}\n`))

      await page.goto(`${BASE}/admin/setup?tab=sources`)
      await page.waitForSelector('text=Ways a lead can reach you', { timeout: 20000 })
      await shoot(page, '01-lead-sources', theme, width)

      await page.goto(`${BASE}/admin/setup?tab=import`)
      await page.waitForSelector('text=Add a list of contacts', { timeout: 20000 })
      await shoot(page, '02-import', theme, width)

      if (!EMPTY) {
        // The lift dialog is the whole point of the guard, and it only exists
        // after a click — a static route shot would never show it.
        await page.getByRole('button', { name: /Lift the messaging block/i }).first().click()
        await page.waitForSelector('text=Where did their consent come from?')
        await shoot(page, '03-import-lift-guard', theme, width)
      }

      // No campaigns, no widget — there is nothing to attribute. The empty
      // pass exists to prove the screens are empty, not to shoot a widget that
      // correctly is not there.
      if (EMPTY) {
        await context.close()
        await browser.close()
        continue
      }

      await page.goto(`${BASE}/admin/setup?tab=campaigns`)
      await page.waitForSelector('text=Put this campaign on your website', { timeout: 20000 })
      await page.getByText('Put this campaign on your website').scrollIntoViewIfNeeded()
      await shoot(page, '04-campaign-widget', theme, width)

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
