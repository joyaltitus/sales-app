import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: { from, rpc } }))

const {
  createLead,
  setBotPaused,
  markConversationRead,
  assignConversation,
  saveLead,
  addFollowUp,
  updateFollowUp,
  addNote,
  deleteNote,
} = await import('./crm-actions')

function writeChain(
  result: { data: { id: string }[] | null; error: { message: string } | null } = {
    data: [{ id: 'row-1' }], error: null,
  },
) {
  const chain = {
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => Promise.resolve(result)),
  }
  return chain
}

describe('crm-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a lead with one atomic RPC and normalized identity', async () => {
    rpc.mockResolvedValue({ data: 'lead-new', error: null })

    await expect(createLead('client-1', {
      profileName: ' Amit Kumar ',
      phone: '98765 43210',
      channel: 'phone',
      stageId: 'stage-1',
      estValue: 60000,
      nextAction: ' Schedule intro demo ',
      note: ' First call ',
    })).resolves.toEqual({ ok: true, leadId: 'lead-new' })

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('create_manual_lead', {
      p_client_id: 'client-1',
      p_profile_name: 'Amit Kumar',
      p_external_id: '919876543210',
      p_channel: 'phone',
      p_stage_id: 'stage-1',
      p_est_value: 60000,
      p_next_action: 'Schedule intro demo',
      p_note: 'First call',
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('uses only create_manual_lead for an agent manual lead, with no direct leads insert or fallback', async () => {
    rpc.mockResolvedValue({ data: 'lead-new', error: null })

    await expect(createLead('client-1', {
      profileName: 'Agent-owned lead', phone: '9876543210', stageId: 'stage-1',
    })).resolves.toEqual({ ok: true, leadId: 'lead-new' })

    expect(rpc).toHaveBeenCalledWith('create_manual_lead', expect.any(Object))
    expect(from).not.toHaveBeenCalled()
  })

  it('reports an RLS/membership denial without attempting browser fallback writes', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not authorized for supplied client' } })

    await expect(createLead('client-a', {
      profileName: 'Cross tenant', phone: '9999999999', stageId: 'client-b-stage',
    })).resolves.toEqual({ ok: false, reason: 'denied', message: 'not authorized for supplied client' })
    expect(from).not.toHaveBeenCalled()
  })

  it('scopes every direct update/delete by client_id and row id, and every insert carries client_id', async () => {
    const chains: ReturnType<typeof writeChain>[] = []
    from.mockImplementation(() => {
      const chain = writeChain()
      chains.push(chain)
      return chain
    })

    await setBotPaused('client-1', 'conv-1', true)
    await markConversationRead('client-1', 'conv-2')
    await assignConversation('client-1', 'conv-3', 'user-1')
    await saveLead('client-1', 'lead-1', 'stage-old', { status: 'won' })
    await addFollowUp('client-1', {
      contact_id: 'contact-1', lead_id: 'lead-1', conversation_id: null,
      due_at: '2026-08-20T00:00:00Z', note: 'Call', channel: 'phone', created_by: 'user-1',
    })
    await updateFollowUp('client-1', 'follow-1', 'pending', 'done')
    await addNote('client-1', { conversation_id: 'conv-1', lead_id: null, author: 'user-1', body: 'Note' })
    await deleteNote('client-1', 'note-1')

    const rowIds = ['conv-1', 'conv-2', 'conv-3', 'lead-1', null, 'follow-1', null, 'note-1']
    chains.forEach((chain, index) => {
      if (rowIds[index]) {
        expect(chain.eq).toHaveBeenCalledWith('client_id', 'client-1')
        expect(chain.eq).toHaveBeenCalledWith('id', rowIds[index])
      } else {
        expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-1' }))
      }
    })
  })

  it('treats zero affected rows as denied for every direct write', async () => {
    from.mockImplementation(() => writeChain({ data: [], error: null }))

    const results = await Promise.all([
      setBotPaused('client-1', 'conv-1', true),
      markConversationRead('client-1', 'conv-2'),
      assignConversation('client-1', 'conv-3', null),
      saveLead('client-1', 'lead-1', 'stage-1', { status: 'lost' }),
      addFollowUp('client-1', { contact_id: 'c', lead_id: null, conversation_id: null, due_at: 'x', note: '', channel: 'phone', created_by: null }),
      updateFollowUp('client-1', 'follow-1', 'pending', 'cancel'),
      addNote('client-1', { conversation_id: 'conv-1', lead_id: null, author: null, body: 'x' }),
      deleteNote('client-1', 'note-1'),
    ])
    expect(results).toEqual(Array.from({ length: 8 }, () => ({ ok: false, reason: 'denied' })))
  })

  describe('markConversationRead acknowledgement', () => {
    it('dispatches only after a successful write', async () => {
      const dispatch = vi.spyOn(window, 'dispatchEvent')
      from.mockReturnValue(writeChain())

      await expect(markConversationRead('client-1', 'conv-1')).resolves.toEqual({ ok: true })
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect((dispatch.mock.calls[0][0] as CustomEvent).detail).toEqual({ clientId: 'client-1', conversationId: 'conv-1' })
    })

    it.each([
      ['RLS denial', { data: [], error: null }],
      ['network failure', { data: null, error: { message: 'network unavailable' } }],
    ])('does not dispatch on %s', async (_label, result) => {
      const dispatch = vi.spyOn(window, 'dispatchEvent')
      from.mockReturnValue(writeChain(result as { data: { id: string }[] | null; error: { message: string } | null }))

      const response = await markConversationRead('client-1', 'conv-1')
      expect(response.ok).toBe(false)
      expect(dispatch).not.toHaveBeenCalled()
    })
  })
})
