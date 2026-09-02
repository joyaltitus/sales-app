import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutboxEntry } from './contracts'

const writes = vi.hoisted(() => ({
  completeCall: vi.fn(),
  addFollowUp: vi.fn(),
  addNote: vi.fn(),
  saveLeadLastWriteWins: vi.fn(),
  updateFollowUp: vi.fn(),
  logObjection: vi.fn(),
  createLead: vi.fn(),
}))

vi.mock('@app/lib/calls-data', () => ({ completeCall: writes.completeCall }))
vi.mock('@app/lib/crm-actions', () => ({
  addFollowUp: writes.addFollowUp,
  addNote: writes.addNote,
  saveLeadLastWriteWins: writes.saveLeadLastWriteWins,
  updateFollowUp: writes.updateFollowUp,
  createLead: writes.createLead,
}))
vi.mock('@app/lib/objections-data', () => ({ logObjection: writes.logObjection }))

import { WRITE_REGISTRY } from './outbox-store'

function entry(kind: OutboxEntry['kind'], args: Record<string, unknown>): OutboxEntry {
  return { id: 'client-uuid', kind, args, created_at: '2026-08-26T10:00:00Z', attempts: 0, last_error: null }
}

describe('closed write registry', () => {
  beforeEach(() => Object.values(writes).forEach((mock) => mock.mockReset()))

  it('contains exactly the frozen safe kinds and no send operation', () => {
    expect(Object.keys(WRITE_REGISTRY).sort()).toEqual([
      'add_follow_up', 'add_note', 'create_lead', 'delete_spin', 'log_objection', 'log_outcome',
      'playbook_gap', 'save_lead', 'save_spin', 'script_feedback', 'script_used', 'token_received',
      'update_follow_up',
    ])
  })

  it('passes the client-minted uuid to a note insert and accepts duplicate-key replay as done', async () => {
    writes.addNote.mockResolvedValue({ ok: false, reason: 'error', code: '23505', message: 'duplicate key' })
    await expect(WRITE_REGISTRY.add_note(entry('add_note', {
      client_id: 'client-a', conversation_id: null, lead_id: 'lead-a', author: 'user-a', body: 'Called back',
    }))).resolves.toBeUndefined()
    expect(writes.addNote).toHaveBeenCalledWith('client-a', expect.objectContaining({ id: 'client-uuid' }))
  })

  it('replays a save-as-lead through create_manual_lead, never a direct leads insert', async () => {
    writes.createLead.mockResolvedValue({ ok: true, leadId: 'lead-new' })
    await expect(WRITE_REGISTRY.create_lead(entry('create_lead', {
      client_id: 'client-a', profile_name: 'Anjali Rao', phone: '+919876543210',
      channel: 'whatsapp', stage_id: 'stage-a', note: 'Saved from a WhatsApp Web chat by the rep.',
    }))).resolves.toBeUndefined()
    expect(writes.createLead).toHaveBeenCalledWith('client-a', expect.objectContaining({
      profileName: 'Anjali Rao', phone: '+919876543210', channel: 'whatsapp', stageId: 'stage-a',
    }))
  })

  it('does not swallow an ordinary first failure', async () => {
    writes.saveLeadLastWriteWins.mockResolvedValue({ ok: false, reason: 'error', message: 'network down' })
    await expect(WRITE_REGISTRY.save_lead(entry('save_lead', {
      client_id: 'client-a', lead_id: 'lead-a', patch: { status: 'won' },
    }))).rejects.toThrow('network down')
  })
})
