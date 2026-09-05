import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/geist'
import './index.css'
import { App } from './App'

// REG-057. The comment here used to say a new build "swaps on next load"; it did
// not. With injectManifest and a hand-written worker, nothing called
// skipWaiting(), so a new worker parked in `waiting` until every tab of the
// origin closed — and in autoUpdate mode onNeedRefresh is never called, so
// there was no way to know. Joyal ships to real clients next month; a rep on a
// stale build after a deploy is a live hazard with no symptom.
//
// Prompt, don't force: the swap reloads the page, and doing that unasked
// under a rep mid-call is its own bug. Plain DOM rather than React so the
// notice still appears if the app tree itself is what failed to boot.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (document.getElementById('sw-update')) return
    const bar = document.createElement('div')
    bar.id = 'sw-update'
    bar.setAttribute('role', 'status')
    bar.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;' +
      'display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);' +
      'padding:10px 12px 10px 16px;border-radius:10px;border:1px solid var(--border-strong,#c8d1ca);' +
      'background:var(--surface-raised,#fff);color:var(--fg,#17201c);' +
      'font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18)'

    const text = document.createElement('span')
    text.textContent = 'A new version is ready.'

    const action = document.createElement('button')
    action.type = 'button'
    action.textContent = 'Reload'
    action.style.cssText =
      'min-height:36px;padding:0 14px;border:0;border-radius:8px;cursor:pointer;' +
      'background:var(--accent,#146b4a);color:var(--accent-fg,#fff);font:inherit'
    // updateSW() posts SKIP_WAITING to the waiting worker, which src/sw.ts now
    // answers; workbox-window reloads the page once it takes control.
    action.addEventListener('click', () => {
      action.disabled = true
      action.textContent = 'Reloading…'
      void updateSW(true)
    })

    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.textContent = 'Later'
    dismiss.setAttribute('aria-label', 'Dismiss the update notice')
    dismiss.style.cssText =
      'min-height:36px;padding:0 10px;border:0;border-radius:8px;cursor:pointer;' +
      'background:transparent;color:var(--fg-muted,#4d5a54);font:inherit'
    dismiss.addEventListener('click', () => bar.remove())

    bar.append(text, action, dismiss)
    document.body.appendChild(bar)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
