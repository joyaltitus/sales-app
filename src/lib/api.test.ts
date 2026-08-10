import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession, refreshSession, loadGatewayKey, clearGatewayKey } = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  loadGatewayKey: vi.fn(),
  clearGatewayKey: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession, refreshSession } },
}))
vi.mock('./gateway-key', () => ({ loadGatewayKey, clearGatewayKey }))

const { hubFetch } = await import('./api')

function requestHeader(fetchMock: { mock: { calls: unknown[][] } }, call: number, name: string) {
  const request = fetchMock.mock.calls[call]?.[1] as RequestInit
  return new Headers(request.headers).get(name)
}

describe('hub authentication recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadGatewayKey.mockReturnValue('browser-key')
    getSession.mockResolvedValue({ data: { session: { access_token: 'old-jwt' } } })
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh-jwt' } }, error: null })
  })

  it('refreshes once but preserves credentials when the retry is still unauthorized', async () => {
    const body = JSON.stringify({ conversation_id: 'conversation-1', text: 'Hello' })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    const result = await hubFetch('/api/agent-send', { method: 'POST', body })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body })
    expect(requestHeader(fetchMock, 1, 'x-pm-gateway-key')).toBe('browser-key')
    expect(requestHeader(fetchMock, 1, 'x-pm-user-jwt')).toBe('fresh-jwt')
    expect(clearGatewayKey).not.toHaveBeenCalled()
    expect(result).toEqual({ kind: 'unauthorized' })
  })

  it('returns success when the refreshed session is admitted', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))

    const result = await hubFetch<{ ok: boolean }>('/api/agent-send', {
      method: 'POST',
      body: '{}',
      headers: {
        'x-pm-gateway-key': 'caller-must-not-override',
        'x-pm-user-jwt': 'caller-must-not-override',
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestHeader(fetchMock, 0, 'x-pm-gateway-key')).toBe('browser-key')
    expect(requestHeader(fetchMock, 0, 'x-pm-user-jwt')).toBe('old-jwt')
    expect(requestHeader(fetchMock, 1, 'x-pm-gateway-key')).toBe('browser-key')
    expect(requestHeader(fetchMock, 1, 'x-pm-user-jwt')).toBe('fresh-jwt')
    expect(clearGatewayKey).not.toHaveBeenCalled()
    expect(result).toEqual({ kind: 'ok', data: { ok: true } })
  })

  it.each([
    ['a mixed-case object', {
      'Content-Type': 'caller-content',
      'X-PM-GATEWAY-KEY': 'caller-key',
      'X-PM-USER-JWT': 'caller-jwt',
    }],
    ['a Headers instance', new Headers({
      'Content-Type': 'caller-content',
      'X-PM-GATEWAY-KEY': 'caller-key',
      'X-PM-USER-JWT': 'caller-jwt',
    })],
    ['header tuples', [
      ['Content-Type', 'caller-content'],
      ['X-PM-GATEWAY-KEY', 'caller-key'],
      ['X-PM-USER-JWT', 'caller-jwt'],
    ] as [string, string][]],
  ])('keeps client authentication headers authoritative over %s', async (_format, headers) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    await hubFetch('/api/agent-send', { method: 'POST', headers })

    expect(requestHeader(fetchMock, 0, 'content-type')).toBe('application/json')
    expect(requestHeader(fetchMock, 0, 'x-pm-gateway-key')).toBe('browser-key')
    expect(requestHeader(fetchMock, 0, 'x-pm-user-jwt')).toBe('old-jwt')
    expect(requestHeader(fetchMock, 1, 'content-type')).toBe('application/json')
    expect(requestHeader(fetchMock, 1, 'x-pm-gateway-key')).toBe('browser-key')
    expect(requestHeader(fetchMock, 1, 'x-pm-user-jwt')).toBe('fresh-jwt')
  })

  it('preserves the access key when the browser session cannot refresh', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 401 }))
    refreshSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('expired') })

    const result = await hubFetch('/api/agent-send', { method: 'POST', body: '{}' })

    expect(clearGatewayKey).not.toHaveBeenCalled()
    expect(result).toEqual({ kind: 'no_session' })
  })

  it.each([
    [400, undefined, { kind: 'bad_request' }],
    [403, undefined, { kind: 'forbidden' }],
    [404, undefined, { kind: 'not_found' }],
    [503, { error: 'paused' }, { kind: 'paused' }],
    [503, { error: 'auth_unavailable' }, { kind: 'unavailable' }],
    [418, undefined, { kind: 'network', message: 'HTTP 418' }],
  ])('keeps the existing mapping when the refreshed retry returns %s', async (status, body, expected) => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(body ? JSON.stringify(body) : null, { status }))

    const result = await hubFetch('/api/agent-send', { method: 'POST', body: '{}' })

    expect(clearGatewayKey).not.toHaveBeenCalled()
    expect(result).toEqual(expected)
  })

  it('maps a rejected refreshed retry to a network failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new Error('offline'))

    const result = await hubFetch('/api/agent-send', { method: 'POST' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ kind: 'network', message: 'offline' })
  })
})
