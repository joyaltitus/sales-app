/**
 * ext-shots — screenshot every panel screen from the BUILT extension.
 *
 * Playwright's own Chromium, because branded Chrome 137+ ignores
 * --load-extension. No live login: the Supabase origin is intercepted and
 * answered from fixtures, and the session is seeded straight into
 * chrome.storage.local (which is where our own storage adapter looks), so this
 * runs unwatched without a real credential ever being typed.
 *
 * The WhatsApp side is a test double injected before React mounts: the panel
 * asks chrome.tabs for a WhatsApp tab and talks to the content script through
 * it, so faking those two calls is what lets the chat-dependent screens be
 * captured without driving a real WhatsApp session.
 *
 *   node scripts/ext-shots.mjs [outDir]
 */
import { chromium } from '/Users/joyaltitus/Documents/hub-service/node_modules/playwright/index.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EXT = path.join(ROOT, '.output/chrome-mv3')
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/ui-review/rep-cockpit'))
const WIDTH = 400
const HEIGHT = 900

const CLIENT = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'

const now = Date.now()
const iso = (offsetMs) => new Date(now + offsetMs).toISOString()

const QUEUE = [
  { lead_id: 'l-1', contact_id: 'c-1', person_id: null, display_name: 'Anjali Rao', phone_e164: '+919876543210', channel: 'whatsapp', stage_key: 'contacted', stage_label: 'Contacted', status: 'open', owner: { user_id: USER, display_name: 'Ravi' }, due_at: iso(-3 * 3600e3), follow_up_id: 'f-1', last_activity_at: iso(-4 * 3600e3), reason: 'overdue' },
  { lead_id: 'l-2', contact_id: 'c-2', person_id: null, display_name: 'Vikram Shah', phone_e164: '+919812345678', channel: 'whatsapp', stage_key: 'demo', stage_label: 'Demo booked', status: 'open', owner: { user_id: USER, display_name: 'Ravi' }, due_at: iso(2 * 3600e3), follow_up_id: 'f-2', last_activity_at: iso(-26 * 3600e3), reason: 'due' },
  { lead_id: 'l-3', contact_id: 'c-3', person_id: null, display_name: 'Meera Krishnan', phone_e164: '+919900112233', channel: 'whatsapp', stage_key: 'new', stage_label: 'New', status: 'open', owner: null, due_at: null, follow_up_id: null, last_activity_at: iso(-2 * 3600e3), reason: 'new' },
  { lead_id: 'l-4', contact_id: 'c-4', person_id: null, display_name: 'Sandeep Kulkarni', phone_e164: '+919700445566', channel: 'instagram', stage_key: 'nurture', stage_label: 'Nurture', status: 'open', owner: null, due_at: null, follow_up_id: null, last_activity_at: iso(-72 * 3600e3), reason: 'idle' },
]

const TABLES = {
  user_client_memberships: [{ client_id: CLIENT, clients: { id: CLIENT, name: 'Bright Academy' } }],
  profiles: [{ user_id: USER, display_name: 'Ravi Menon', client_id: CLIENT }],
  rep_queue_v: QUEUE,
  employee_targets: [{ id: 't-1', client_id: CLIENT, user_id: USER, month: '2026-09-01', target_value: 400000, incentive_per_won: 2500, bonus_at_target: 15000, created_by: USER, created_at: iso(0), updated_at: iso(0) }],
  leads: [{ est_value: 120000 }, { est_value: 65000 }],
  objection_taxonomy: [
    { id: 'ot-1', key: 'price', label: 'Too expensive', aliases: [], status: 'active' },
    { id: 'ot-2', key: 'timing', label: 'Wrong time', aliases: [], status: 'active' },
    { id: 'ot-3', key: 'spouse', label: 'Needs to ask family', aliases: [], status: 'active' },
  ],
  script_versions: [
    { id: 'sv-1', script_id: 'sc-1', version: 3, status: 'approved', headline: 'Fee structure', change_note: null, created_by: USER, created_at: iso(0), scripts: { id: 'sc-1', taxonomy_id: 'ot-1' }, body: { paragraphs: [{ before: 'Hi {{name}} — the full fee is ₹48,000, and we do a 3-instalment plan at no extra cost. ', highlight: 'Most people start on the plan.', after: '' }] } },
    { id: 'sv-2', script_id: 'sc-2', version: 2, status: 'approved', headline: 'Next batch', change_note: null, created_by: USER, created_at: iso(0), scripts: { id: 'sc-2', taxonomy_id: 'ot-2' }, body: { paragraphs: [{ before: 'Hi {{name}}, the next batch starts Monday and two seats are open. ', highlight: 'Shall I hold one?', after: '' }] } },
    { id: 'sv-3', script_id: 'sc-3', version: 1, status: 'approved', headline: 'Family decision', change_note: null, created_by: USER, created_at: iso(0), scripts: { id: 'sc-3', taxonomy_id: 'ot-3' }, body: { paragraphs: [{ before: 'Totally fair, {{name}}. Would it help if I sent a one-page summary you can share at home?', highlight: null, after: '' }] } },
  ],
  lead_stages: [
    { id: 's-1', stage_key: 'new', label: 'New', sort_order: 1, is_won: false },
    { id: 's-2', stage_key: 'contacted', label: 'Contacted', sort_order: 2, is_won: false },
    { id: 's-3', stage_key: 'demo', label: 'Demo booked', sort_order: 3, is_won: false },
  ],
}

const CHAT_MESSAGES = [
  { id: 'm1', direction: 'in', text: 'Hi, is the September batch still open?', voice: null, at: '8:42 pm, 02/09/2026', author: 'Anjali Rao' },
  { id: 'm2', direction: 'out', text: 'Yes — two seats left. Shall I hold one for you?', voice: null, at: '8:44 pm, 02/09/2026', author: 'You' },
  { id: 'm3', direction: 'in', text: 'What are the fees?', voice: null, at: '8:45 pm, 02/09/2026', author: 'Anjali Rao' },
  { id: 'm4', direction: 'in', text: '', voice: '0:42', at: '8:46 pm, 02/09/2026', author: 'Anjali Rao' },
  { id: 'm5', direction: 'out', text: 'Sending the fee structure now.', voice: null, at: '8:48 pm, 02/09/2026', author: 'You' },
]

/** Answer the Supabase REST/auth surface from the fixtures above. */
async function stubSupabase(context, supabaseOrigin) {
  await context.route(`${supabaseOrigin}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: USER, email: 'ravi@example.com' } }) })
    }
    const table = url.pathname.replace('/rest/v1/', '')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TABLES[table] ?? []),
    })
  })
}

async function shoot(page, name, theme) {
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(OUT, `${name}-${theme}.png`) })
  process.stdout.write(`  ✓ ${name}-${theme}.png\n`)
}

async function run() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  for (const theme of ['light', 'dark']) {
    const userDataDir = path.join(ROOT, `.output/.shot-profile-${theme}`)
    await rm(userDataDir, { recursive: true, force: true })
    const context = await chromium.launchPersistentContext(userDataDir, {
      // Extensions require a headed context: an MV3 service worker never
      // registers under old headless, so waitForEvent('serviceworker') hangs and
      // there is no extension id to navigate to.
      headless: false,
      colorScheme: theme,
      viewport: { width: WIDTH, height: HEIGHT },
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    })

    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent('serviceworker')
    const id = new URL(worker.url()).host
    const panel = `chrome-extension://${id}/sidepanel.html`
    const options = `chrome-extension://${id}/options.html`

    // Read the origins the build actually baked in, so this never drifts from
    // .env.production.
    const supabaseUrl = await worker.evaluate(() =>
      // eslint-disable-next-line no-undef
      chrome.runtime.getManifest().host_permissions[0].replace('/*', ''),
    )
    await stubSupabase(context, supabaseUrl)

    const page = await context.newPage()
    page.on('pageerror', (error) => process.stderr.write(`  ! pageerror: ${error.message}\n`))
    page.on('console', (m) => { if (m.type() === 'error') process.stderr.write(`  ! console: ${m.text().slice(0, 200)}\n`) })

    // 1. Signed out.
    await page.goto(panel)
    await page.waitForSelector('text=Sign in')
    await shoot(page, '01-signin', theme)

    // Seed a session where our storage adapter looks for it, and stand up the
    // WhatsApp doubles before any module runs.
    const ref = new URL(supabaseUrl).hostname.split('.')[0]
    await page.evaluate(async ([ref, user, expires]) => {
      await chrome.storage.local.set({
        [`sb-${ref}-auth-token`]: JSON.stringify({
          access_token: 'stub', refresh_token: 'stub', token_type: 'bearer',
          expires_at: expires, expires_in: 3600, user: { id: user, email: 'ravi@example.com' },
        }),
      })
    }, [ref, USER, Math.floor(now / 1000) + 3600])

    // Screens with NO WhatsApp tab open — the panel's resting state, and the
    // only way to see Home, because a matched chat correctly pushes past it.
    // The saved route is cleared first: it survives inside one browser context,
    // so without this every later capture reopens on the last lead.
    await page.evaluate(() => chrome.storage.session.remove('rep.panelNavigation'))
    await page.goto(panel)
    try {
      await page.waitForSelector('text=Do this next', { timeout: 15000 })
    } catch (error) {
      process.stderr.write(`  ! body: ${(await page.textContent('body')).slice(0, 400)}\n`)
      throw error
    }
    await shoot(page, '02-home', theme)

    await page.getByRole('link', { name: 'CRM' }).click()
    await page.waitForSelector('text=Meera Krishnan')
    await shoot(page, '03-crm', theme)

    // Search + a date window, which is what this tab is for.
    await page.getByLabel('Search leads').fill('vikram')
    await page.waitForTimeout(500)
    await shoot(page, '04-crm-search', theme)
    await page.getByLabel('Search leads').fill('')
    await page.waitForTimeout(500)

    await page.getByText('Meera Krishnan').click()
    await page.waitForSelector('text=Before the call')
    await shoot(page, '06-lead', theme)

    await page.getByRole('link', { name: 'Library' }).click()
    await page.waitForTimeout(400)
    await shoot(page, '07-library', theme)

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.waitForSelector('text=Open chats in')
    await shoot(page, '08-settings', theme)

    // A MATCHED chat. The panel pushes straight to that lead — this shot is F1's
    // whole point, so it is captured as the arrival rather than staged.
    await page.evaluate(() => chrome.storage.session.remove('rep.panelNavigation'))
    const followed = await context.newPage()
    followed.on('pageerror', (error) => process.stderr.write(`  ! pageerror: ${error.message}\n`))
    await followed.addInitScript((messages) => {
      const chat = { title: 'Anjali Rao', jid: '919876543210@c.us' }
      chrome.tabs.query = async () => [{ id: 99, active: true, url: 'https://web.whatsapp.com/' }]
      chrome.tabs.sendMessage = async (_id, message) => {
        if (message.type === 'rep.wa.read') return chat
        if (message.type === 'rep.wa.messages') return { messages }
        return { ok: true }
      }
    }, CHAT_MESSAGES)
    await followed.goto(panel)
    await followed.waitForSelector('text=Following Anjali Rao', { timeout: 15000 })
    await followed.waitForSelector('text=Before the call')
    await shoot(followed, '09-following-chat', theme)

    await followed.getByText('Snippets', { exact: true }).click()
    await shoot(followed, '10-snippets', theme)

    await followed.getByRole('button', { name: 'Save conversation to CRM' }).click()
    await followed.waitForSelector('text=Save this conversation')
    await shoot(followed, '11-save-conversation', theme)
    await followed.close()

    // An UNMATCHED chat: the Save-as-lead card on Home.
    await page.evaluate(() => chrome.storage.session.remove('rep.panelNavigation'))
    const unknown = await context.newPage()
    await unknown.addInitScript(() => {
      chrome.tabs.query = async () => [{ id: 99, active: true, url: 'https://web.whatsapp.com/' }]
      chrome.tabs.sendMessage = async (_id, message) =>
        message.type === 'rep.wa.read' ? { title: '+91 90000 11122', jid: '919000011122@c.us' } : { ok: true }
    })
    await unknown.goto(panel)
    await unknown.waitForSelector('text=Not in your CRM yet', { timeout: 15000 })
    await shoot(unknown, '12-save-as-lead', theme)

    // Same chat, entered the other way: the CRM's own Add form, offering to
    // copy whoever is open in WhatsApp.
    await unknown.getByRole('link', { name: 'CRM' }).click()
    await unknown.getByRole('button', { name: 'Add' }).click()
    await unknown.waitForSelector('text=New lead')
    await unknown.getByRole('button', { name: /Use open chat/ }).click()
    await shoot(unknown, '05-crm-add-lead', theme)
    await unknown.close()

    // 10. Options page — wider, it is a full tab.
    const optionsPage = await context.newPage()
    await optionsPage.setViewportSize({ width: 720, height: 1000 })
    await optionsPage.goto(options)
    await optionsPage.waitForSelector('text=Rep settings')
    await optionsPage.waitForTimeout(400)
    await optionsPage.screenshot({ path: path.join(OUT, `13-options-${theme}.png`), fullPage: true })
    process.stdout.write(`  ✓ 13-options-${theme}.png\n`)

    await context.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
  process.stdout.write(`\nWrote ${OUT}\n`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
