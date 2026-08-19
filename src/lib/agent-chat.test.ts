import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession, loadGatewayKey } = vi.hoisted(() => ({
  getSession: vi.fn(),
  loadGatewayKey: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession, refreshSession: vi.fn() } },
}))
vi.mock('./gateway-key', () => ({ loadGatewayKey, clearGatewayKey: vi.fn() }))

const { sendAgentChat, approveChecklist, AGENT_CHAT_PATH, AGENT_APPROVE_PATH } = await import('./agent-chat')

describe('sendAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadGatewayKey.mockReturnValue('browser-key')
    getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } })
  })

  it('posts client_id and anchor fields alongside the text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, reply: 'hi', source: 'intent', steps: [], checklist: [], session_id: 's1', session_closed: null, session_closed_reason: null, model_calls: 0 }), { status: 200 }),
    )

    const res = await sendAgentChat({ text: 'Summarise this customer', sessionId: null, clientId: 'client-1', anchorContactId: null, anchorLeadId: null })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(AGENT_CHAT_PATH)
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(body).toEqual({ text: 'Summarise this customer', client_id: 'client-1', session_id: null, anchor_contact_id: null, anchor_lead_id: null })
    expect(res).toEqual({ kind: 'ok', data: { ok: true, reply: 'hi', source: 'intent', steps: [], checklist: [], session_id: 's1', session_closed: null, session_closed_reason: null, model_calls: 0 } })
  })

  it('reports a zero-model-call starter tap through the intent source, not a plan call', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, reply: 'ok', source: 'intent', steps: [], checklist: [], session_id: 's1', session_closed: null, session_closed_reason: null, model_calls: 0 }), { status: 200 }),
    )

    const res = await sendAgentChat({ text: 'Which leads should I revive today?', sessionId: null, clientId: null, anchorContactId: null, anchorLeadId: null })

    expect(res.kind).toBe('ok')
    if (res.kind === 'ok' && res.data.ok) {
      expect(res.data.source).toBe('intent')
      expect(res.data.model_calls).toBe(0)
    }
  })
})

describe('approveChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadGatewayKey.mockReturnValue('browser-key')
    getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } })
  })

  it('sends every decided approval in a single request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, session_id: 's1', items: [] }), { status: 200 }),
    )

    await approveChecklist('s1', 'client-1', [{ id: 'step-1', tier: 'one_tap' }])

    expect(fetchMock.mock.calls[0]?.[0]).toBe(AGENT_APPROVE_PATH)
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(body).toEqual({ session_id: 's1', client_id: 'client-1', approvals: [{ id: 'step-1', tier: 'one_tap' }] })
  })
})
