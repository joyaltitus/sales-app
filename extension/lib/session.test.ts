import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_KEYS } from './cache'
import { OUTBOX_KEY } from './outbox-store'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./panel-client', () => ({ panelSupabase: { auth } }))

describe('session failure and sign-out boundaries', () => {
  beforeEach(() => {
    auth.getSession.mockReset()
    auth.signOut.mockClear()
    auth.signOut.mockImplementation(async () => {
      await chrome.storage.local.remove('sb-shared-auth-token')
      return { error: null }
    })
  })

  it('a forced refresh failure leaves queued writes intact', async () => {
    const queued = [{ id: 'offline-note' }]
    await chrome.storage.local.set({ [OUTBOX_KEY]: queued })
    const before = ((await chrome.storage.local.get(OUTBOX_KEY))[OUTBOX_KEY] as unknown[]).length
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('refresh failed') })
    const { checkPanelSession } = await import('./session')

    await expect(checkPanelSession()).resolves.toMatchObject({ ok: false, reason: 'refresh_failed' })
    const after = ((await chrome.storage.local.get(OUTBOX_KEY))[OUTBOX_KEY] as unknown[]).length
    expect({ before, after }).toEqual({ before: 1, after: 1 })
    console.info(`forced refresh failure: outbox before=${before}; after=${after}`)
  })

  it('sign-out removes all panel caches without clearing the outbox', async () => {
    await chrome.storage.local.set({
      [CACHE_KEYS.leadDetails]: [{ data: { lead: { lead_id: 'lead-1' } }, fetched_at: '2026-08-26T10:00:00Z' }],
      [CACHE_KEYS.queue]: { data: [], fetched_at: '2026-08-26T10:00:00Z' },
      [CACHE_KEYS.library]: { data: { scripts: [], courses: [], config: null, spins: [] }, fetched_at: '2026-08-26T10:00:00Z' },
      [OUTBOX_KEY]: [{ id: 'offline-note' }],
      'sb-shared-auth-token': 'session-one',
    })
    const { signOutExtension } = await import('./session')
    await signOutExtension()

    const stored = await chrome.storage.local.get([...Object.values(CACHE_KEYS), OUTBOX_KEY, 'sb-shared-auth-token'])
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(stored[CACHE_KEYS.leadDetails]).toBeUndefined()
    expect(stored[CACHE_KEYS.queue]).toBeUndefined()
    expect(stored[CACHE_KEYS.library]).toBeUndefined()
    expect(stored['sb-shared-auth-token']).toBeUndefined()
    expect(stored[OUTBOX_KEY]).toHaveLength(1)
  })
})
