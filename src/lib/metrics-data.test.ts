import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession, loadGatewayKey } = vi.hoisted(() => ({
  getSession: vi.fn(),
  loadGatewayKey: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession, refreshSession: vi.fn() } },
}))
vi.mock('./gateway-key', () => ({ loadGatewayKey, clearGatewayKey: vi.fn() }))

const { fetchMetrics } = await import('./metrics-data')

describe('fetchMetrics client_id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadGatewayKey.mockReturnValue('browser-key')
    getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } })
  })

  it('omits client_id when none is given', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }))
    await fetchMetrics('14d')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/metrics?window=14d')
  })

  it('appends client_id when a manager belongs to more than one client (hub-service otherwise 400s ambiguous_client)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }))
    await fetchMetrics('14d', 'client-1')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/metrics?window=14d&client_id=client-1')
  })
})
