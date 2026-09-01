import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWorkerSession, readWorkerNotices } from './worker-api'

const AUTH_KEY = 'sb-test-auth-token'

describe('lightweight worker API', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('reads a valid cached session without waking the auth server', async () => {
    const session = { access_token: 'access', refresh_token: 'refresh', expires_at: 2_000_000_000, user: { id: 'user-1' } }
    await chrome.storage.local.set({ [AUTH_KEY]: JSON.stringify(session) })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(getWorkerSession(1_000)).resolves.toEqual(session)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads memberships once and fetches due follow-ups and lead notices in parallel', async () => {
    const fetch = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input)
      if (url.includes('user_client_memberships')) return new Response(JSON.stringify([{ client_id: 'client-1' }]))
      if (url.includes('follow_ups')) return new Response(JSON.stringify([{ id: 'follow-1', note: 'Call', due_at: '2026-08-31T10:00:00Z' }]))
      return new Response(JSON.stringify([{ id: 'notice-1', title: 'New lead', body: null }]))
    })
    vi.stubGlobal('fetch', fetch)

    const result = await readWorkerNotices(
      { access_token: 'access', refresh_token: 'refresh', user: { id: 'user-1' } },
      '2026-08-31T10:00:00Z',
    )

    expect(result.due).toHaveLength(1)
    expect(result.newLeads).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(String(fetch.mock.calls[1][0])).toContain('client_id=in.%28client-1%29')
  })
})
