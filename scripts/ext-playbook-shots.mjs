/**
 * ext-playbook-shots — capture the in-call HUD from the BUILT extension at the
 * width the panel actually gets, and MEASURE that nothing overflows it.
 *
 * Same doubles as scripts/ext-shots.mjs (Supabase intercepted and answered from
 * fixtures, session seeded into chrome.storage.local, WhatsApp faked at the
 * chrome.tabs boundary). Separate file rather than more branches in that one:
 * this runs at 380×700 — the narrowest real panel — and its whole point is the
 * overflow assertion, which the cockpit shots have no business failing on.
 *
 *   node scripts/ext-playbook-shots.mjs [outDir]
 */
import { chromium } from '/Users/joyaltitus/Documents/hub-service/node_modules/playwright/index.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EXT = path.join(ROOT, '.output/chrome-mv3')
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/ui-review/2026-09-02-playbook-extension'))
const WIDTH = 380
const HEIGHT = 700

const CLIENT = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'

const now = Date.now()
const iso = (offsetMs) => new Date(now + offsetMs).toISOString()

const QUEUE = [
  { lead_id: 'l-1', contact_id: 'c-1', person_id: null, display_name: 'Anjali Rao', phone_e164: '+919876543210', channel: 'whatsapp', stage_key: 'contacted', stage_label: 'Contacted', status: 'open', owner: { user_id: USER, display_name: 'Ravi' }, due_at: iso(-3 * 3600e3), follow_up_id: 'f-1', last_activity_at: iso(-4 * 3600e3), reason: 'overdue' },
  { lead_id: 'l-2', contact_id: 'c-2', person_id: null, display_name: 'Vikram Shah', phone_e164: '+919812345678', channel: 'whatsapp', stage_key: 'demo', stage_label: 'Demo booked', status: 'open', owner: { user_id: USER, display_name: 'Ravi' }, due_at: iso(2 * 3600e3), follow_up_id: 'f-2', last_activity_at: iso(-26 * 3600e3), reason: 'due' },
]

const p = (before, highlight, after) => ({ before, ...(highlight ? { highlight } : {}), ...(after ? { after } : {}) })

// The longest Manglish paragraph in the seed — this is what the width
// assertion is actually testing against.
const LONGEST_MN =
  'Ithu oru complete full-stack development bootcamp aanu — HTML, CSS, JavaScript, React, Node, PostgreSQL ellaam undu, ' +
  'pinne placement-support um. Fee {{course.fee}} aanu, EMI {{course.emi}} × {{course.emi_months}} months. ' +
  'Batch {{course.batch_start}} thudangum, seat block cheyyaan {{pay.amount}} maathram mathi. ' +
  'Njangalude previous batch-il {{course.proof}}. Link ithaanu: {{pay.url}}'

const TAXONOMY = [
  { id: 'ot-hook-cold', key: 'stage_hook_cold', label: 'Opener — cold', aliases: [], status: 'active', kind: 'stage', position: 10, icon: 'phone' },
  { id: 'ot-hook-in', key: 'stage_hook_inbound', label: 'Opener — inbound', aliases: [], status: 'active', kind: 'stage', position: 11, icon: 'message-circle' },
  { id: 'ot-hook-fu', key: 'stage_hook_followup', label: 'Opener — follow-up', aliases: [], status: 'active', kind: 'stage', position: 12, icon: 'clock' },
  { id: 'ot-discover', key: 'stage_discover', label: 'Find the why', aliases: [], status: 'active', kind: 'stage', position: 20, icon: 'help-circle' },
  { id: 'ot-pitch', key: 'stage_pitch', label: 'The offer', aliases: [], status: 'active', kind: 'stage', position: 30, icon: 'graduation-cap' },
  { id: 'ot-close', key: 'stage_close', label: 'Ask for the seat', aliases: [], status: 'active', kind: 'stage', position: 40, icon: 'badge-check' },
  { id: 'ot-token', key: 'token_request', label: 'Seat token text', aliases: [], status: 'active', kind: 'stage', position: 90, icon: 'credit-card' },
  { id: 'ot-callback', key: 'callback_confirm', label: 'Callback confirmation', aliases: [], status: 'active', kind: 'stage', position: 91, icon: 'calendar' },
  { id: 'ot-price', key: 'price', label: 'Too expensive', aliases: [], status: 'active', kind: 'objection', position: 1, icon: 'wallet' },
  { id: 'ot-timing', key: 'timing', label: 'Wrong time', aliases: [], status: 'active', kind: 'objection', position: 2, icon: 'clock' },
  { id: 'ot-spouse', key: 'spouse', label: 'Needs to ask family', aliases: [], status: 'active', kind: 'objection', position: 3, icon: 'users' },
  { id: 'ot-trust', key: 'trust', label: 'Never heard of you', aliases: [], status: 'active', kind: 'objection', position: 4, icon: 'shield-alert' },
]

const version = (id, taxonomyId, body, over = {}) => ({
  id, script_id: `sc-${id}`, version: 3, status: 'standard', headline: null, change_note: null,
  created_by: USER, created_at: iso(-30 * 86400e3), body,
  scripts: { id: `sc-${id}`, taxonomy_id: taxonomyId }, ...over,
})

const VERSIONS = [
  version('sv-hook-cold', 'ot-hook-cold', { lang: 'en', paragraphs: [p('Hi {{name}}, {{rep}} here from {{client.name}}. Two minutes?')] }),
  version('sv-hook-in', 'ot-hook-in', { lang: 'en', paragraphs: [p('Hi {{name}}, {{rep}} from {{client.name}} — you asked about {{course.name}}.')] }),
  version('sv-hook-fu', 'ot-hook-fu', { lang: 'en', paragraphs: [p('Hi {{name}}, {{rep}} again — picking up where we left off on {{course.name}}.')] }),
  version('sv-discover', 'ot-discover', {
    lang: 'en',
    paragraphs: [p('What made you look at this ', 'now', ' rather than last year?')],
    variants: { mn: { paragraphs: [p('Ippo entha ithu nokkaan thonniyathu?')] } },
  }),
  version('sv-pitch', 'ot-pitch', {
    lang: 'en',
    paragraphs: [
      p('{{course.name}} runs {{course.duration}}, fee {{course.fee}}. ', 'EMI is {{course.emi}} a month.', ''),
      p('{{course.usp}} — {{course.proof}}.'),
    ],
    variants: { mn: { paragraphs: [p(LONGEST_MN)] } },
  }),
  version('sv-close', 'ot-close', { lang: 'en', paragraphs: [p('Shall I block a seat for you with ', '{{pay.amount}}', '?')] }),
  version('sv-token', 'ot-token', {
    lang: 'en',
    paragraphs: [p('{{name}}, to block your seat in {{course.name}}: pay {{pay.amount}} here — {{pay.url}}\nUPI: {{pay.upi}}')],
    variants: { mn: { paragraphs: [p('{{name}}, seat block cheyyaan {{pay.amount}} — {{pay.url}} · UPI {{pay.upi}}')] } },
  }),
  version('sv-callback', 'ot-callback', { lang: 'en', paragraphs: [p('Locked it in, {{name}} — I will call you ', '{{callback.when}}', '.')] }),
  version('sv-price', 'ot-price', {
    lang: 'en',
    paragraphs: [p('Compare the loaded rate — fee, materials and placement support are all in it. ', 'EMI is {{course.emi}} a month.', '')],
    variants: { mn: { paragraphs: [p('Loaded rate nokkoo — fee, materials, placement support ellaam ullathaanu. EMI {{course.emi}} maathram.')] } },
  }, { headline: 'Anchor on the loaded rate, not the sticker' }),
  version('sv-timing', 'ot-timing', { lang: 'en', paragraphs: [p('The next batch starts {{course.batch_start}}; after that it is three months away.')] }, { headline: 'The next batch is the real deadline' }),
  version('sv-spouse', 'ot-spouse', { lang: 'en', paragraphs: [p('Totally fair. Shall I send a one-page summary you can show at home?')] }, { headline: 'Give them something to show at home' }),
  version('sv-trust', 'ot-trust', { lang: 'en', paragraphs: [p('{{course.proof}} — happy to put you on a call with one of them.')] }),
]

const TABLES = {
  user_client_memberships: [{ client_id: CLIENT, role: 'agent' }],
  clients: [{ id: CLIENT, name: 'Bright Academy', timezone: 'Asia/Kolkata', sales_config: {
    languages: ['en', 'mn'], default_lang: 'en',
    upi_vpa: 'bright@okhdfcbank', upi_payee: 'Bright Academy',
    pay_url: 'https://pay.brightacademy.in/seat', token_amount: 2000, token_note: 'Seat token',
  } }],
  profiles: [{ user_id: USER, display_name: 'Ravi Menon', client_id: CLIENT }],
  rep_queue_v: QUEUE,
  employee_targets: [{ id: 't-1', client_id: CLIENT, user_id: USER, month: '2026-09-01', target_value: 400000, incentive_per_won: 2500, bonus_at_target: 15000, created_by: USER, created_at: iso(0), updated_at: iso(0) }],
  leads: [{ est_value: 120000 }, { est_value: 65000 }],
  objection_taxonomy: TAXONOMY,
  script_versions: VERSIONS,
  script_win_rates_v: [
    { client_id: CLIENT, script_version_id: 'sv-pitch', uses: 22, rated: 18, won: 11 },
    { client_id: CLIENT, script_version_id: 'sv-price', uses: 31, rated: 25, won: 17 },
    { client_id: CLIENT, script_version_id: 'sv-timing', uses: 9, rated: 6, won: 3 },
    { client_id: CLIENT, script_version_id: 'sv-close', uses: 14, rated: 12, won: 7 },
    { client_id: CLIENT, script_version_id: 'sv-spouse', uses: 2, rated: 1, won: 1 },
  ],
  items: [
    { id: 'item-0003', client_id: CLIENT, name: 'Full Stack Bootcamp', category: 'course', active: true, sales_facts: {
      fee: 85000, emi_monthly: 7100, emi_months: 12, duration: '6 months', batch_start: '2026-10-15',
      usp: 'Placement support until you land the job', proof: '312 alumni placed last year', token_amount: 5000,
    } },
    { id: 'item-0004', client_id: CLIENT, name: 'Data Analytics Sprint', category: 'course', active: true, sales_facts: { fee: 42000, duration: '10 weeks', batch_start: '2026-09-29' } },
  ],
  quick_replies: [{
    id: 'qr-1', client_id: CLIENT, scope: 'personal', script_id: 'sc-sv-pitch', lang: 'en',
    title: 'The offer', body: 'Look — {{course.fee}} all in, or {{course.emi}} a month. I did this course myself, that is why I push it.',
    created_by: USER, updated_at: iso(-3 * 86400e3),
  }],
  lead_stages: [
    { id: 's-1', stage_key: 'new', label: 'New', sort_order: 1, is_won: false },
    { id: 's-2', stage_key: 'contacted', label: 'Contacted', sort_order: 2, is_won: false },
    { id: 's-3', stage_key: 'demo', label: 'Demo booked', sort_order: 3, is_won: false },
  ],
  call_sessions: [{ id: 'cs-1' }],
}

const RPC = {
  pm_log_call_outcome: [{ call_log_id: 'cl-1', objection_log_id: null, follow_up_id: null, active_script_version_id: null }],
}

/** Answer the Supabase REST/auth surface from the fixtures above. */
async function stubSupabase(context, supabaseOrigin) {
  await context.route(`${supabaseOrigin}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: USER, email: 'ravi@example.com' } }) })
    }
    const rest = url.pathname.replace('/rest/v1/', '')
    const rows = rest.startsWith('rpc/') ? (RPC[rest.slice(4)] ?? []) : (TABLES[rest] ?? [])
    // .single()/.maybeSingle() ask PostgREST for an object, not an array —
    // hand back one, or the identity read silently resolves to undefined.
    const wantsObject = (route.request().headers()['accept'] ?? '').includes('pgrst.object')
    const body = wantsObject ? (rows[0] ?? null) : rows
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

/**
 * Click a design-system Button.
 *
 * They carry `hover:-translate-y-px`, and Playwright's own hover-then-check
 * inside click() oscillates against that 1px shift — it never sees two frames
 * with the same box and times out on "element is not stable". Settling the
 * hover first is the honest fix: it is what a real cursor does anyway.
 */
async function tap(locator) {
  await locator.hover({ force: true })
  await locator.click()
}

const failures = []

/**
 * The 380px contract: nothing inside the panel may be wider than the panel.
 * scrollWidth > clientWidth is exactly "this element has content it cannot
 * show without a sideways scroll", which at 380px is the bug the rep hits.
 */
async function assertFits(page, selector, label) {
  const measured = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
  }, selector)
  if (!measured) {
    failures.push(`${label}: no element matched ${selector}`)
    return
  }
  const ok = measured.scrollWidth <= measured.clientWidth
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${label}: scrollWidth ${measured.scrollWidth} ≤ clientWidth ${measured.clientWidth}\n`)
  if (!ok) failures.push(`${label}: scrollWidth ${measured.scrollWidth} > clientWidth ${measured.clientWidth}`)
}

async function shoot(page, name, theme) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `${name}-${theme}.png`) })
  process.stdout.write(`  ✓ ${name}-${theme}.png\n`)
}

async function run() {
  await mkdir(OUT, { recursive: true })

  for (const theme of ['light', 'dark']) {
    const userDataDir = path.join(ROOT, `.output/.playbook-profile-${theme}`)
    await rm(userDataDir, { recursive: true, force: true })
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      colorScheme: theme,
      // Deterministic captures: the design system's own reduced-motion branch
      // turns every transition off, so a screenshot is never taken mid-fade and
      // a click never waits on a 1px hover translate to settle.
      reducedMotion: 'reduce',
      viewport: { width: WIDTH, height: HEIGHT },
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    })

    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent('serviceworker')
    const id = new URL(worker.url()).host
    const panel = `chrome-extension://${id}/sidepanel.html`

    const supabaseUrl = await worker.evaluate(() =>
      // eslint-disable-next-line no-undef
      chrome.runtime.getManifest().host_permissions[0].replace('/*', ''),
    )
    await stubSupabase(context, supabaseUrl)

    const page = await context.newPage()
    page.on('pageerror', (error) => process.stderr.write(`  ! pageerror: ${error.message}\n`))
    page.on('console', (m) => { if (m.type() === 'error') process.stderr.write(`  ! console: ${m.text().slice(0, 200)}\n`) })

    await page.goto(panel)
    await page.waitForSelector('text=Sign in')
    const ref = new URL(supabaseUrl).hostname.split('.')[0]
    await page.evaluate(async ([ref, user, expires]) => {
      await chrome.storage.local.set({
        [`sb-${ref}-auth-token`]: JSON.stringify({
          access_token: 'stub', refresh_token: 'stub', token_type: 'bearer',
          expires_at: expires, expires_in: 3600, user: { id: user, email: 'ravi@example.com' },
        }),
      })
    }, [ref, USER, Math.floor(now / 1000) + 3600])
    await page.evaluate(() => chrome.storage.session.remove('rep.panelNavigation'))

    await page.goto(panel)
    await page.waitForSelector('text=Do this next', { timeout: 20000 })
    await page.getByRole('link', { name: 'CRM' }).click()
    await page.getByText('Anjali Rao').click()
    await page.waitForSelector('[data-testid="call-hud"]', { timeout: 20000 })

    // 1. The HUD as a rep first sees it: no course picked, opener open.
    await page.evaluate(() => {
      const hud = document.querySelector('[data-testid="call-hud"]')
      const scroller = hud?.closest('main')
      // The lead header is sticky over the top ~110px of the scroller, so aligning
      // the HUD to the scroller's top edge parks its first row underneath it.
      if (hud && scroller) scroller.scrollTop += hud.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 118
    })
    await shoot(page, '01-hud-default', theme)
    await assertFits(page, '[data-testid="call-hud"]', `${theme} · HUD (no course)`)

    // 2. The hook selector, switched off the guess.
    await tap(page.getByRole('button', { name: 'Cold' }))
    await shoot(page, '02-hook-selector', theme)

    // 3. Numbers filled, and the longest Manglish paragraph on screen.
    const hudOnly = page.getByTestId('call-hud')
    await page.getByLabel('Course').selectOption('item-0003')
    await tap(hudOnly.getByRole('button', { name: 'Next', exact: true }))
    await tap(hudOnly.getByRole('button', { name: 'Next', exact: true }))
    await shoot(page, '03-hud-offer-course-picked', theme)
    await tap(hudOnly.getByRole('button', { name: 'MN', exact: true }))
    await page.waitForTimeout(200)
    await shoot(page, '04-hud-manglish-longest', theme)
    await assertFits(page, '[data-testid="call-hud"]', `${theme} · HUD (longest Manglish)`)
    await tap(hudOnly.getByRole('button', { name: 'EN', exact: true }))

    // 4. An objection interrupts the roadmap.
    await tap(page.getByRole('button', { name: /Too expensive/ }))
    await page.waitForSelector('text=Anchor on the loaded rate')
    await shoot(page, '05-rebuttal-card', theme)
    await assertFits(page, 'section[aria-label^="Rebuttal:"]', `${theme} · RebuttalCard`)

    // 5. The full script, standard and the rep's own spin.
    await tap(page.getByRole('button', { name: /Open Too expensive in full/ }))
    await page.waitForSelector('[role="dialog"]')
    await shoot(page, '06-script-sheet-standard', theme)
    await assertFits(page, '[role="dialog"] .sheet-panel', `${theme} · ScriptSheet`)
    await page.keyboard.press('Escape')
    await tap(page.getByRole('button', { name: /back to/ }))
    await tap(page.getByRole('button', { name: /Open The offer in full/ }))
    await page.waitForSelector('text=My spin')
    await shoot(page, '07-script-sheet-spin', theme)
    await page.keyboard.press('Escape')

    // 6. Close row: the token ask, opened.
    await tap(page.getByRole('button', { name: /seat link/ }))
    await page.waitForTimeout(300)
    await shoot(page, '08-token-close-row', theme)

    // 7. The feedback strip, after an outcome.
    await tap(page.getByRole('button', { name: 'Progressing' }))
    await page.waitForSelector('text=scripts used this call', { timeout: 15000 })
    await page.getByRole('group', { name: 'Rate the scripts you used' }).scrollIntoViewIfNeeded()
    await shoot(page, '09-feedback-strip', theme)

    // 8. Library and Settings.
    await page.getByRole('link', { name: 'Library' }).click()
    await page.waitForSelector('text=Call roadmap', { timeout: 15000 })
    await shoot(page, '10-library', theme)
    await assertFits(page, 'main', `${theme} · Library`)

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.waitForSelector('text=Open chats in')
    await shoot(page, '11-settings', theme)

    await context.close()
    await rm(userDataDir, { recursive: true, force: true })
  }

  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length} overflow failure(s):\n${failures.map((f) => `  - ${f}`).join('\n')}\n`)
    process.exit(1)
  }
  process.stdout.write(`\nWrote ${OUT} — nothing overflowed 380px.\n`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
