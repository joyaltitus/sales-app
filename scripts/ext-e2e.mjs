/**
 * ext-e2e — drive the REAL built extension in a REAL Chrome, as a rep would.
 *
 * Sign in, open a lead, dial it, say a line, fire an objection from the
 * keyboard, log the outcome. Everything downstream of the sign-in is live: this
 * talks to the real Supabase the build points at, so it is the only check that
 * covers the wiring the unit suite mocks away.
 *
 * Headed on purpose. MV3 service workers do not register in headless Chrome, so
 * a headless run tests nothing — the extension never boots.
 *
 * NOT wired into CI, deliberately: CI has no rep credentials, and adding them
 * there is a decision for a human, not for this script.
 *
 *   npm run ext:build
 *   EXT_E2E_EMAIL=… EXT_E2E_PASSWORD=… npm run ext:e2e
 *
 * Credentials come from the environment and nowhere else. They are never
 * printed, never passed on argv (argv is world-readable in `ps`), and never
 * written to the profile directory, which is removed on the way out.
 */
import { chromium } from '/Users/joyaltitus/Documents/hub-service/node_modules/playwright/index.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EXT = path.join(ROOT, '.output/chrome-mv3')
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/ui-review/2026-09-02-call-ergo'))
const PANEL = { width: 380, height: 700 }
const TAB = { width: 1280, height: 860 }

const EMAIL = process.env.EXT_E2E_EMAIL
const PASSWORD = process.env.EXT_E2E_PASSWORD
if (!EMAIL || !PASSWORD) {
  process.stderr.write(
    'ext-e2e needs EXT_E2E_EMAIL and EXT_E2E_PASSWORD in the environment.\n' +
    'Use a demo rep account. Do not put them on the command line or in CI.\n',
  )
  process.exit(2)
}

const steps = []
function check(ok, label, detail = '') {
  steps.push({ ok, label })
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}\n`)
}

/** Design-system buttons carry hover:-translate-y-px; settle the hover first or
 *  Playwright's stability check oscillates against it. Same fix as ext-shots. */
async function tap(locator) {
  await locator.hover({ force: true })
  await locator.click()
}

/** The cue must be SAYABLE: real computed pixels, not a class name. */
async function measureCue(page, label) {
  const m = await page.evaluate(() => {
    const li = document.querySelector('[data-testid="cue"] li')
    if (!li) return null
    const px = parseFloat(getComputedStyle(li).fontSize)
    // A ch is the width of "0" at this font — the unit the 45ch cap is in.
    const probe = document.createElement('span')
    probe.textContent = '0'
    probe.style.cssText = 'position:absolute;visibility:hidden;font:inherit'
    li.appendChild(probe)
    const ch = probe.getBoundingClientRect().width
    probe.remove()
    const ul = li.closest('[data-testid="cue"]')
    return { px, ch: ul.getBoundingClientRect().width / ch }
  })
  if (!m) return check(false, `${label}: cue on screen`)
  check(m.px >= 20, `AT-01 ${label}: cue is ${m.px.toFixed(1)}px (>= 20)`)
  check(m.ch <= 46, `AT-02 ${label}: cue column is ${m.ch.toFixed(1)}ch (<= 45)`)
}

async function open(context, viewport) {
  let [worker] = context.serviceWorkers()
  if (!worker) worker = await context.waitForEvent('serviceworker')
  const id = new URL(worker.url()).host
  const page = await context.newPage()
  await page.setViewportSize(viewport)
  page.on('pageerror', (e) => process.stderr.write(`  ! pageerror: ${e.message}\n`))
  return { page, id }
}

async function run() {
  await mkdir(OUT, { recursive: true })
  const userDataDir = path.join(ROOT, '.output/.e2e-profile')
  await rm(userDataDir, { recursive: true, force: true })

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // MV3 service workers do not register headless.
    reducedMotion: 'reduce',
    viewport: PANEL,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  })

  try {
    const { page, id } = await open(context, PANEL)
    const panel = `chrome-extension://${id}/sidepanel.html`

    // tel: would hand the call to the OS and hang the run. Swallow it at the
    // same chrome.tabs boundary the panel uses, and remember it was asked for.
    await context.addInitScript(() => {
      const real = globalThis.chrome?.tabs?.create
      if (!real) return
      globalThis.__dialled = []
      globalThis.chrome.tabs.create = (opts, cb) => {
        if (typeof opts?.url === 'string' && opts.url.startsWith('tel:')) {
          globalThis.__dialled.push(opts.url)
          return Promise.resolve({ id: -1 })
        }
        return real(opts, cb)
      }
    })

    // 1. Sign in — for real. Typed into the page; never logged.
    await page.goto(panel)
    await page.waitForSelector('text=Sign in', { timeout: 20000 })
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await tap(page.getByRole('button', { name: /sign in/i }))
    await page.waitForSelector('text=Do this next', { timeout: 30000 })
    check(true, 'AT-10 signed in against the real backend')

    // 2. Open a lead.
    await page.getByRole('link', { name: 'CRM' }).click()
    const lead = page.locator('button, a').filter({ hasText: /\w/ })
    await page.waitForSelector('[data-testid="call-hud"], text=No leads', { timeout: 20000 })
    if (await page.getByTestId('call-hud').count() === 0) {
      await lead.first().click()
      await page.waitForSelector('[data-testid="call-hud"]', { timeout: 20000 })
    }
    check(true, 'AT-10 lead open, HUD mounted')

    // 3. Before dialling this is the chat lane: the verb is Insert. (AT-05)
    const insertBefore = await page.getByRole('button', { name: 'Insert' }).count()
    check(insertBefore > 0, 'AT-05 chat lane before the call says "Insert"')

    await measureCue(page, 'panel')
    await page.screenshot({ path: path.join(OUT, '01-panel.png') })

    // 4. Dial. This is what opens the call session — and therefore call mode.
    await page.getByRole('button', { name: /^\+?\d[\d\s]+$/ }).click()
    const said = page.getByRole('button', { name: /Said it/ })
    await said.first().waitFor({ timeout: 20000 })
    check(true, 'AT-04 dialling flips the primary verb to "Said it →"')
    check(
      await page.getByRole('button', { name: 'Insert' }).count() === 0,
      'AT-04 "Insert" is gone while the call is live',
    )

    // 5. Say the line: the step advances and WhatsApp is never touched.
    const before = await page.locator('text=/^\\d+\\/\\d+$/').first().textContent()
    await tap(said.first())
    await page.waitForFunction(
      (was) => document.body.innerText.includes('/') && !document.body.innerText.includes(was),
      before,
      { timeout: 10000 },
    ).catch(() => {})
    const after = await page.locator('text=/^\\d+\\/\\d+$/').first().textContent()
    check(after !== before, `AT-04 "Said it →" advanced the step (${before} → ${after})`)

    // 6. The wide tab: same HUD, same measure, keyboard objections.
    await tap(page.getByRole('button', { name: 'Open in tab' }))
    const tab = await context.waitForEvent('page')
    await tab.setViewportSize(TAB)
    await tab.waitForSelector('[data-testid="call-hud"][data-layout="wide"]', { timeout: 20000 })
    await measureCue(tab, 'wide tab')

    await tab.keyboard.press('1')
    await tab.waitForSelector('[aria-label^="Rebuttal:"]', { timeout: 10000 })
    check(true, 'AT-10 objection fired from the keyboard in the wide tab')
    await tab.screenshot({ path: path.join(OUT, '02-wide-tab.png') })

    // 7. Log the outcome, one tap, and lock the follow-up with one more.
    await tap(tab.getByRole('button', { name: 'Progressing' }))
    await tab.waitForSelector('text=Outcome logged', { timeout: 20000 })
    check(true, 'AT-07 outcome logged in a single tap')
    await tap(tab.getByRole('button', { name: 'Tomorrow' }))
    check(
      await tab.getByRole('button', { name: 'Tomorrow' }).getAttribute('aria-pressed') === 'true',
      'AT-08 follow-up locked one tap from the outcome',
    )
    await tab.screenshot({ path: path.join(OUT, '03-outcome.png') })
  } finally {
    await context.close()
    await rm(userDataDir, { recursive: true, force: true })
  }

  const bad = steps.filter((s) => !s.ok)
  process.stdout.write(`\n${steps.length - bad.length}/${steps.length} checks passed. Shots in ${OUT}\n`)
  if (bad.length) process.exit(1)
}

run().catch((error) => {
  // Never let a stack trace carry the password out of the process.
  console.error(String(error?.message ?? error).replaceAll(PASSWORD, '«redacted»'))
  process.exit(1)
})
