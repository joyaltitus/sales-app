import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { hubFetch } = vi.hoisted(() => ({ hubFetch: vi.fn() }))
vi.mock('./api', () => ({ hubFetch }))

const VAPID_KEY = 'BExample-url-safe-base64-vapid-public-key_1234567890'

function stubPushApis(opts: {
  permission?: NotificationPermission
  existingSubscription?: unknown
  subscribeResult?: unknown
}) {
  const requestPermission = vi.fn().mockResolvedValue(opts.permission ?? 'granted')
  vi.stubGlobal('Notification', { requestPermission })

  const getSubscription = vi.fn().mockResolvedValue(opts.existingSubscription ?? null)
  const subscribe = vi.fn().mockResolvedValue(opts.subscribeResult)
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }),
    },
  })
  return { requestPermission, getSubscription, subscribe }
}

function fakeSubscription(over: Partial<{ endpoint: string; p256dh: string; auth: string }> = {}) {
  const endpoint = over.endpoint ?? 'https://push.example/abc'
  return {
    endpoint,
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({
      endpoint,
      keys: { p256dh: over.p256dh ?? 'p256dh-value', auth: over.auth ?? 'auth-value' },
    }),
  }
}

describe('push subscribe/unsubscribe', () => {
  beforeEach(() => {
    vi.resetModules()
    hubFetch.mockReset()
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID_KEY)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    // biome-ignore lint/performance/noDelete: test cleanup of a property this suite defines
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker
  })

  it('pushSupported is false without a configured VAPID key', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '')
    stubPushApis({})
    const { pushSupported } = await import('./push')
    expect(pushSupported()).toBe(false)
  })

  it('subscribe() returns unsupported when the browser lacks the Push API', async () => {
    const { subscribe } = await import('./push')
    const result = await subscribe()
    expect(result).toEqual({ kind: 'unsupported' })
    expect(hubFetch).not.toHaveBeenCalled()
  })

  it('subscribe() returns denied when the permission prompt is declined', async () => {
    stubPushApis({ permission: 'denied' })
    const { subscribe } = await import('./push')
    const result = await subscribe()
    expect(result).toEqual({ kind: 'denied' })
    expect(hubFetch).not.toHaveBeenCalled()
  })

  it('subscribe() happy path: posts the real subscription endpoint/keys, returns ok', async () => {
    const sub = fakeSubscription({ endpoint: 'https://push.example/xyz' })
    stubPushApis({ permission: 'granted', existingSubscription: null, subscribeResult: sub })
    hubFetch.mockResolvedValue({ kind: 'ok', data: { ok: true } })

    const { subscribe } = await import('./push')
    const result = await subscribe()

    expect(result).toEqual({ kind: 'ok' })
    expect(hubFetch).toHaveBeenCalledWith('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: 'https://push.example/xyz',
        keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
      }),
    })
  })

  it('subscribe() reuses an existing subscription instead of creating a new one', async () => {
    const existing = fakeSubscription()
    const { subscribe: subscribeSpy } = stubPushApis({
      permission: 'granted',
      existingSubscription: existing,
    })
    hubFetch.mockResolvedValue({ kind: 'ok', data: { ok: true } })

    const { subscribe } = await import('./push')
    await subscribe()

    expect(subscribeSpy).not.toHaveBeenCalled()
  })

  it('subscribe() maps a hub failure to hub_error without throwing', async () => {
    stubPushApis({ permission: 'granted', subscribeResult: fakeSubscription() })
    hubFetch.mockResolvedValue({ kind: 'forbidden' })

    const { subscribe } = await import('./push')
    const result = await subscribe()
    expect(result).toEqual({ kind: 'hub_error', detail: 'forbidden' })
  })

  it('unsubscribe() returns no_subscription when nothing is subscribed', async () => {
    stubPushApis({ existingSubscription: null })
    const { unsubscribe } = await import('./push')
    const result = await unsubscribe()
    expect(result).toEqual({ kind: 'no_subscription' })
    expect(hubFetch).not.toHaveBeenCalled()
  })

  it('unsubscribe() happy path: unsubscribes locally and tells the hub', async () => {
    const sub = fakeSubscription({ endpoint: 'https://push.example/gone' })
    stubPushApis({ existingSubscription: sub })
    hubFetch.mockResolvedValue({ kind: 'ok', data: { ok: true } })

    const { unsubscribe } = await import('./push')
    const result = await unsubscribe()

    expect(result).toEqual({ kind: 'ok' })
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1)
    expect(hubFetch).toHaveBeenCalledWith('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: 'https://push.example/gone' }),
    })
  })
})
