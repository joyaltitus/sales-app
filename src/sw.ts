/// <reference lib="webworker" />
// S12 SA-PUSH-01: injectManifest strategy (generateSW has no hook for a hand-written push
// listener). self.__WB_MANIFEST is replaced at build time with the real precache list — same
// app-shell caching the old generateSW config gave us, plus push + notificationclick below.
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Same offline-tolerance behaviour the old generateSW `navigateFallback: '/index.html'`
// gave us: an offline/uncached deep-link navigation still serves the cached shell instead
// of failing, so the app never looks dead on a dropped connection (useOnline.ts).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

interface PushPayload {
  title: string
  body?: string | null
  kind: string
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = { title: 'Sales App', kind: 'unknown' }
  try {
    if (event.data) payload = event.data.json() as PushPayload
  } catch {
    /* malformed payload — fall back to the generic title above rather than dropping the push */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body ?? undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.kind, // same kind replaces its own prior notification instead of stacking
    }),
  )
})

// Focuses an already-open tab, or opens the app root — the three role shells (rep/manager/
// admin) each have their own inbox base path, so a precise deep link belongs to a future
// card, not this one; getting the rep INTO the app is the spec's ask.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = clientsList.find((c) => 'focus' in c)
      if (existing) {
        await (existing as WindowClient).focus()
        return
      }
      await self.clients.openWindow('/')
    })(),
  )
})
