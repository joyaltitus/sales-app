// Manual, machine-specific verification for REG-057 (service-worker update).
//
// NOT a CI test: it imports Playwright by absolute path from a sibling repo's
// node_modules, exactly the fragility trap 8 of the master doc warns about, and
// it needs two real builds of this app. It lives here as reproducible evidence,
// not as part of `npm test`.
//
// How to run it:
//   1. npm run build                      # build A
//   2. cp -R dist <dir>/v1
//   3. edit index.html's <title> to something distinguishable, npm run build
//   4. cp -R dist <dir>/v2 ; revert index.html
//   5. node docs/sessions/uxw01-stabilization/sw-update-verify.mjs <dir>
//
// Result on 2026-09-05, macOS, Chromium via ~/Documents/hub-service:
//   with the fix    — all 7 checks pass ("RESULT: VERIFIED")
//   against 13a1d23 — "the update notice appears" times out: the new worker
//                     parks in `waiting`, onNeedRefresh is never called, and the
//                     tab stays on build A with no symptom.
// End-to-end proof for REG-057: does a second deploy actually reach an open tab?
// Two real builds, one origin, one browser. Nothing here is stubbed.
import playwright from '/Users/joyaltitus/Documents/hub-service/node_modules/playwright/index.js'
const { chromium } = playwright
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { cp, rm } from 'node:fs/promises'

const ROOT = process.argv[2]
const SERVE = join(ROOT, 'serve')
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
}

await rm(SERVE, { recursive: true, force: true })
await cp(join(ROOT, 'v1'), SERVE, { recursive: true })

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let file = join(SERVE, url.pathname === '/' ? 'index.html' : url.pathname)
  let body
  try {
    body = await readFile(file)
  } catch {
    file = join(SERVE, 'index.html')
    body = await readFile(file)
  }
  // A service worker must not be served from cache, or the update check is moot.
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  res.end(body)
})
await new Promise((r) => server.listen(4183, r))

const log = (...a) => console.log('[sw-verify]', ...a)
const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
let failed = false
const check = (name, ok) => { log(ok ? 'PASS' : 'FAIL', name); if (!ok) failed = true }

try {
  await page.goto('http://localhost:4183/', { waitUntil: 'load' })
  // A first-ever registration activates but does not claim the page that
  // registered it — there is no clientsClaim() here, by design. One reload is
  // what makes the tab controlled, exactly as it is for a real first visit.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 })
  check('v1 worker controls the tab', true)
  check('v1 is what the tab is running', (await page.title()).includes('Sales App') && !(await page.title()).includes('SWTEST-V2'))

  // The deploy.
  await rm(SERVE, { recursive: true, force: true })
  await cp(join(ROOT, 'v2'), SERVE, { recursive: true })
  log('deployed v2')

  // A reload is what a rep does; it must NOT silently swap the build...
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(1500)
  const titleAfterReload = await page.title()
  check('a plain reload does not swap the build under the user', !titleAfterReload.includes('SWTEST-V2'))

  // ...it must ASK.
  const bar = page.locator('#sw-update')
  await bar.waitFor({ state: 'visible', timeout: 25000 })
  check('the update notice appears', true)
  check('the notice says what it is', (await bar.innerText()).includes('new version is ready'))

  // And the action must actually deliver the new build.
  await page.click('#sw-update button')
  await page.waitForFunction(() => document.title.includes('SWTEST-V2'), null, { timeout: 25000 })
  check('accepting the update delivers v2', true)

  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 })
  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return { waiting: !!reg?.waiting, active: !!reg?.active }
  })
  check('no worker left parked in waiting', state.waiting === false && state.active === true)
} catch (err) {
  failed = true
  log('FAIL', err.message)
} finally {
  await browser.close()
  server.close()
}
log(failed ? 'RESULT: FAILED' : 'RESULT: VERIFIED')
process.exit(failed ? 1 : 0)
