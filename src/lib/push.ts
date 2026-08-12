import { hubFetch } from './api'

// S12 SA-PUSH-01 / S12-DELTA mobile-seam law: this is the ONLY file that talks to the
// browser Push API. Every component calls subscribe()/unsubscribe()/isSubscribed();
// a Capacitor build swaps this file's body later, nothing else changes.

export type PushResult =
  | { kind: 'ok' }
  | { kind: 'unsupported' } // no Push API / Notification API / VAPID key configured
  | { kind: 'denied' } // user declined the permission prompt
  | { kind: 'no_subscription' } // unsubscribe() called with nothing to unsubscribe
  | { kind: 'hub_error'; detail: string }

function vapidKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  return key || null
}

// Web Push wants the VAPID key as a Uint8Array, browsers hand it out URL-safe base64.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    vapidKey() !== null
  )
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.ready
    return (await registration.pushManager.getSubscription()) !== null
  } catch {
    return false
  }
}

/** Call this SYNCHRONOUSLY inside a click handler (no `await` before it) — the permission
 *  prompt only fires inside a user gesture; crossing an awaited boundary first loses that
 *  context and the browser silently denies it. */
export async function subscribe(): Promise<PushResult> {
  const applicationServerKey = vapidKey()
  if (!pushSupported() || !applicationServerKey) return { kind: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { kind: 'denied' }

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey) as BufferSource,
    }))

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { kind: 'hub_error', detail: 'malformed subscription' }
  }

  const res = await hubFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  return res.kind === 'ok' ? { kind: 'ok' } : { kind: 'hub_error', detail: res.kind }
}

export async function unsubscribe(): Promise<PushResult> {
  if (!pushSupported()) return { kind: 'unsupported' }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return { kind: 'no_subscription' }

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  const res = await hubFetch('/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  })
  return res.kind === 'ok' ? { kind: 'ok' } : { kind: 'hub_error', detail: res.kind }
}
