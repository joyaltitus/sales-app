/**
 * web-shots — screenshot the Playbook / Teardown surfaces of the WEB app.
 *
 * Same trick as ext-shots.mjs: no live login. The Supabase origin is
 * intercepted and answered from fixtures, and a session is seeded into
 * localStorage where supabase-js looks for it, so this runs unwatched without a
 * real credential ever being typed.
 *
 * Needs the dev server up, started with the same fake origin this intercepts:
 *   VITE_SUPABASE_URL=https://shots.invalid VITE_SUPABASE_ANON_KEY=x npm run dev
 *   VITE_SUPABASE_URL=https://shots.invalid node scripts/web-shots.mjs [outDir] [baseUrl]
 */
import { chromium } from '/Users/joyaltitus/Documents/hub-service/node_modules/playwright/index.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/ui-review/2026-09-02-playbook-web'))
const BASE = process.argv[3] ?? 'http://localhost:5173'

const CLIENT = 'a0de0000-0000-4000-8000-000000000001'
const USER = 'b6322df9-687a-48e2-9c49-f1dcf0b65214'
const now = Date.now()
const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString()

// Taken from the environment, never from a .env file — this script only needs
// the ORIGIN to intercept, and it must match whatever the dev server was
// started with:
//   VITE_SUPABASE_URL=https://shots.invalid VITE_SUPABASE_ANON_KEY=x npm run dev
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'https://shots.invalid'

/** Bodies in migration 068's shape: English base + dialect variants. */
const body = (en, mn, hi) => ({
  paragraphs: en,
  lang: 'en',
  variants: { ...(mn ? { mn: { paragraphs: mn } } : {}), ...(hi ? { hi: { paragraphs: hi } } : {}) },
})

const TAX = [
  ['a0de0002-0000-4000-8000-000000000011', 'stage_hook_cold', 'Hook · cold call', 'stage', 10],
  ['a0de0002-0000-4000-8000-000000000014', 'stage_discovery', 'Discovery', 'stage', 20],
  ['a0de0002-0000-4000-8000-000000000015', 'stage_bridge', 'Value bridge', 'stage', 30],
  ['a0de0002-0000-4000-8000-000000000016', 'stage_close', 'Lock next step', 'stage', 40],
  ['a0de0002-0000-4000-8000-000000000017', 'whatsapp_later', 'Send on WhatsApp', 'objection', 1],
  ['a0de0002-0000-4000-8000-000000000018', 'ask_family', 'Ask parents / spouse', 'objection', 2],
  ['a0de0002-0000-4000-8000-000000000019', 'fee_emi', 'Fee / EMI', 'objection', 3],
  ['a0de0002-0000-4000-8000-000000000020', 'guarantee', 'Result guarantee', 'objection', 4],
  ['a0de0002-0000-4000-8000-000000000022', 'token_request', 'Seat reservation text', 'stage', 91],
]

const VERSIONS = [
  ['sv-1', 'sc-1', 'a0de0002-0000-4000-8000-000000000011', 3, 'standard', 'Opening in ten seconds',
    body(
      [{ before: 'Hi {{name}}, this is {{rep}} from {{client.name}}. ', highlight: 'Two minutes — is now alright?', after: '' }],
      [{ before: 'Hi {{name}}, njan {{rep}}, {{client.name}}-il ninnu. ', highlight: 'Randu minutes mathi — ippo cheyyamo?', after: '' }],
    )],
  ['sv-2', 'sc-2', 'a0de0002-0000-4000-8000-000000000014', 2, 'standard', 'Find the real goal',
    body([{ before: 'Before I say anything about fees — ', highlight: 'what is {{name}} aiming for this year?', after: '' }])],
  ['sv-3', 'sc-3', 'a0de0002-0000-4000-8000-000000000015', 4, 'standard', 'Why this batch',
    body(
      [{ before: '{{course.name}} runs {{course.usp}}. ', highlight: '{{course.proof}}.', after: ' That is the difference.' }],
      [{ before: '{{course.name}}-il {{course.usp}} undu. ', highlight: '{{course.proof}}.', after: '' }],
    )],
  ['sv-4', 'sc-4', 'a0de0002-0000-4000-8000-000000000016', 2, 'standard', 'Lock the next step',
    body([{ before: 'Shall I hold a seat and call you {{callback.when}}? ', highlight: 'No payment now.', after: '' }])],
  ['sv-5', 'sc-5', 'a0de0002-0000-4000-8000-000000000017', 1, 'standard', 'Send it on WhatsApp',
    body([{ before: 'Sending now, {{name}}. ', highlight: 'Read it and tell me one thing you liked.', after: '' }])],
  ['sv-6', 'sc-6', 'a0de0002-0000-4000-8000-000000000018', 3, 'standard', 'Bring them in',
    body([{ before: 'Of course — this should be a family decision. ', highlight: 'Shall we do a three-way call?', after: '' }])],
  ['sv-7', 'sc-7', 'a0de0002-0000-4000-8000-000000000019', 5, 'standard', 'Fee and EMI, plainly',
    body(
      [{ before: 'Full fee is ₹{{course.fee}}. ', highlight: 'On EMI it is ₹{{course.emi}} for {{course.emi_months}} months.', after: ' No extra cost for the plan.' }],
      [{ before: 'Full fee ₹{{course.fee}} aanu. ', highlight: 'EMI-yil ₹{{course.emi}}, {{course.emi_months}} months.', after: '' }],
      [{ before: 'पूरी फीस ₹{{course.fee}} है। ', highlight: 'EMI पर ₹{{course.emi}}, {{course.emi_months}} महीने।', after: '' }],
    )],
  ['sv-8', 'sc-8', 'a0de0002-0000-4000-8000-000000000020', 2, 'standard', 'No guarantees, real numbers',
    body([{ before: 'Nobody honest guarantees a rank. ', highlight: '{{course.proof}}', after: ' — that is what we can show you.' }])],
  ['sv-9', 'sc-9', 'a0de0002-0000-4000-8000-000000000022', 2, 'standard', 'Seat reservation',
    body(
      [{ before: '{{name}}, to hold your seat in {{course.name}}: ₹{{pay.amount}} to {{pay.upi}} or {{pay.url}}. ', highlight: 'Seat is held the moment it lands.', after: '' }],
      [{ before: '{{name}}, seat hold cheyyan ₹{{pay.amount}} — {{pay.upi}} or {{pay.url}}. ', highlight: 'Ayachu kazhinja udane seat block aakum.', after: '' }],
    )],
]

const TABLES = {
  user_client_memberships: [{ role: 'manager', clients: { id: CLIENT, name: 'Vidya Sagar Academy', vertical: 'education' } }],
  profiles: [{ user_id: USER, display_name: 'Meera Nair', client_id: CLIENT }],
  clients: {
    sales_config: {
      languages: ['en', 'mn', 'hi'],
      default_lang: 'mn',
      upi_vpa: 'vidyasagar@ybl',
      upi_payee: 'Vidya Sagar Academy',
      pay_url: 'https://example.invalid/pay/vidyasagar',
      token_amount: 500,
      token_note: 'Seat reservation',
    },
  },
  items: [
    {
      id: 'b0de0007-0000-4000-8000-000000000003',
      name: 'NEET Repeater Batch 2027',
      slug: 'neet-repeater-2027',
      price: 85000,
      sales_facts: {
        fee: 85000, emi_monthly: 7100, emi_months: 12, duration: '11 months',
        batch_start: '2026-10-06',
        usp: 'daily tests, a doubt-clearing app and four mentors per batch',
        proof: '142 selections from last year’s batch',
        token_amount: 500,
      },
    },
    { id: 'b0de0007-0000-4000-8000-000000000004', name: 'JEE Advanced Crash 2027', slug: 'jee-crash-2027', price: 42000, sales_facts: { fee: 42000 } },
  ],
  objection_taxonomy: TAX.map(([id, key, label, kind, position]) => ({
    id, key, label, kind, position, aliases: [], status: 'active', icon: null,
  })),
  script_versions: VERSIONS.map(([id, script_id, taxonomy_id, version, status, headline, b]) => ({
    id, script_id, version, status, headline, body: b, change_note: null,
    created_by: USER, created_at: iso(-6 * 864e5), scripts: { id: script_id, taxonomy_id },
  })),
  script_win_rates_v: [
    { client_id: CLIENT, script_version_id: 'sv-7', uses: 30, rated: 24, won: 17 },
    { client_id: CLIENT, script_version_id: 'sv-1', uses: 41, rated: 31, won: 12 },
    { client_id: CLIENT, script_version_id: 'sv-3', uses: 18, rated: 14, won: 11 },
    { client_id: CLIENT, script_version_id: 'sv-6', uses: 12, rated: 3, won: 2 },
    { client_id: CLIENT, script_version_id: 'sv-4', uses: 9, rated: 0, won: 0 },
  ],
  quick_replies: [
    { id: 'qr-1', script_id: 'sc-7', lang: 'mn', title: 'Fee / EMI', body: 'Fee ₹85,000. EMI ayaal ₹7,100 — 12 months. Extra charge onnum illa, {{name}}.', updated_at: iso(-9 * 864e5) },
  ],
  objection_logs: [
    ...Array(9).fill({ taxonomy_id: 'a0de0002-0000-4000-8000-000000000019' }),
    ...Array(6).fill({ taxonomy_id: 'a0de0002-0000-4000-8000-000000000018' }),
    ...Array(4).fill({ taxonomy_id: 'a0de0002-0000-4000-8000-000000000020' }),
    ...Array(2).fill({ taxonomy_id: 'a0de0002-0000-4000-8000-000000000017' }),
  ],
  playbook_gaps: [
    { id: 'g-1', taxonomy_id: 'a0de0002-0000-4000-8000-000000000020', exact_customer_words: 'last year my cousin joined and got nothing back', created_by: USER, created_at: iso(-2 * 864e5) },
    { id: 'g-2', taxonomy_id: 'a0de0002-0000-4000-8000-000000000018', exact_customer_words: 'my father says all these places are the same', created_by: USER, created_at: iso(-4 * 864e5) },
  ],
  rep_queue_v: [],
  leads: [],
  lead_stages: [],
}

/** The Playbook and Teardown shots are a manager; "My script voice" only exists
 *  on the rep's own More screen, so that pass swaps the membership role. */
function setRole(role) {
  TABLES.user_client_memberships = [
    { role, clients: { id: CLIENT, name: 'Vidya Sagar Academy', vertical: 'education' } },
  ]
}

async function stub(context) {
  await context.route(`${SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: USER, email: 'meera@example.com' } }) })
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
    const table = url.pathname.replace('/rest/v1/', '')
    const data = TABLES[table] ?? []
    // .maybeSingle()/.single() ask for an object via the Accept header.
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const payload = single ? (Array.isArray(data) ? (data[0] ?? null) : data) : Array.isArray(data) ? data : [data]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
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
  await page.waitForTimeout(500)
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
      // 390 in dark only duplicates work; the brief asks for light+dark on
      // Library and Teardown, and both widths on everything.
      const browser = await chromium.launch()
      const context = await browser.newContext({ colorScheme: theme, viewport: { width, height: width === 390 ? 844 : 900 } })
      await stub(context)
      await context.addInitScript(([ref, user, expires]) => {
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
          access_token: 'stub', refresh_token: 'stub', token_type: 'bearer',
          expires_at: expires, expires_in: 3600, user: { id: user, email: 'meera@example.com' },
        }))
        localStorage.setItem('sales-app.activeClientId', 'a0de0000-0000-4000-8000-000000000001')
        localStorage.setItem('sales-app.theme', 'system')
      }, [ref, USER, Math.floor(now / 1000) + 3600])

      const page = await context.newPage()
      page.on('pageerror', (e) => process.stderr.write(`  ! pageerror: ${e.message}\n`))

      const go = async (url, waitFor) => {
        await page.goto(`${BASE}${url}`)
        await page.waitForSelector(waitFor, { timeout: 20000 })
      }

      await go('/docs?workspace=playbook', 'text=Call roadmap')
      await shoot(page, '01-library', theme, width)

      if (theme === 'light') {
        await page.getByRole('tab', { name: 'Editor' }).click()
        await page.waitForSelector('text=As the rep sees it')
        await page.getByRole('tab', { name: 'Manglish' }).click()
        await page.waitForTimeout(300)
        await shoot(page, '02-editor-manglish', theme, width)

        await page.getByRole('tab', { name: 'Settings' }).click()
        await page.waitForSelector('text=What the money words say.')
        await shoot(page, '03-settings', theme, width)

        await page.getByRole('tab', { name: 'Courses' }).click()
        await page.waitForSelector('text=NEET Repeater Batch 2027')
        await shoot(page, '04-courses', theme, width)

        await page.getByRole('tab', { name: 'Taxonomy' }).click()
        await page.waitForSelector('text=Company taxonomy')
        await shoot(page, '05-taxonomy', theme, width)

        await page.getByRole('tab', { name: 'Read' }).click()
        await page.waitForSelector('text=The Playbook')
        await shoot(page, '06-read', theme, width)
      }

      await go('/teardown', 'text=What the floor heard this week.')
      await shoot(page, '07-teardown', theme, width)

      if (theme === 'light') {
        await page.getByRole('button', { name: 'Draft rebuttal' }).first().click()
        await page.waitForSelector('text=Why this changed')
        await shoot(page, '08-teardown-fix', theme, width)

        // The rep shell scrolls an inner <main>, so a full-page shot would
        // re-capture from the document top and miss this. Shoot the card.
        setRole('agent')
        await go('/more', 'text=My script voice')
        // Scroll to the one script this rep HAS rewritten, so the shot shows
        // the Custom + "standard changed" state rather than only blank rows.
        // A viewport shot, not fullPage: the shell scrolls an inner <main>.
        await page.getByText('Fee / EMI', { exact: true }).first().scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)
        await assertNoHorizontalScroll(page, `09-my-script-voice-${width}-${theme}`)
        await page.screenshot({ path: path.join(OUT, `09-my-script-voice-${width}-${theme}.png`) })
        process.stdout.write(`  ✓ 09-my-script-voice-${width}-${theme}.png\n`)
        setRole('manager')
      }

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
