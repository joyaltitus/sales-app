import { describe, expect, it } from 'vitest'
import type { ChecklistItem } from '@app/lib/agent-chat'
import { approvalsWithEdits, proposedFields } from './voice-flow'

const checklist: ChecklistItem[] = [
  {
    id: 'crm-1',
    tool: 'propose_crm_update',
    tier: 'one_tap',
    summary: { lead_id: 'lead-1', field: 'next_action', value: 'Model original' },
    dependsOn: [],
    status: 'proposed',
  },
  {
    id: 'follow-1',
    tool: 'create_follow_up',
    tier: 'one_tap',
    summary: { contact_id: 'contact-1', note: 'Call tomorrow' },
    dependsOn: [],
    status: 'proposed',
  },
]

describe('voice proposal approval wall', () => {
  it('renders content fields but never identifiers as editable fields', () => {
    expect(proposedFields(checklist)).toEqual([
      { key: 'crm-1', label: 'Next action', value: 'Model original' },
      { key: 'follow-1', label: 'Follow-up note', value: 'Call tomorrow' },
    ])
  })

  it('puts the rep edit in the separate approval request', () => {
    expect(approvalsWithEdits(checklist, {
      'crm-1': 'Rep edited value',
      'follow-1': 'Call Friday',
    })).toEqual([
      { id: 'crm-1', tier: 'one_tap', edits: { value: 'Rep edited value' } },
      { id: 'follow-1', tier: 'one_tap', edits: { note: 'Call Friday' } },
    ])
  })
})
