import {
  approveChecklist,
  sendAgentChat,
  type Approval,
  type ChecklistItem,
} from '@app/lib/agent-chat'
import { hubFetch, type HubResult } from '@app/lib/api'
import type { ProposedField } from '../ui/VoiceCard'
import type { TranscribeResponse } from './contracts'

export const TRANSCRIBE_PATH = '/api/transcribe'

export function transcribeNote(audio: Blob, clientId: string): Promise<HubResult<TranscribeResponse>> {
  const form = new FormData()
  form.append('audio', audio, 'note.webm')
  form.append('client_id', clientId)
  return hubFetch<TranscribeResponse>(TRANSCRIBE_PATH, { method: 'POST', body: form })
}

function title(value: unknown): string {
  return String(value ?? 'CRM field').replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())
}

export function proposedFields(items: ChecklistItem[]): ProposedField[] {
  return items.flatMap((item) => {
    if (item.status !== 'proposed') return []
    if (item.tool === 'propose_crm_update' && typeof item.summary.value === 'string') {
      return [{ key: item.id, label: title(item.summary.field), value: item.summary.value }]
    }
    if (item.tool === 'create_follow_up' && typeof item.summary.note === 'string') {
      return [{ key: item.id, label: 'Follow-up note', value: item.summary.note }]
    }
    return []
  })
}

export function approvalsWithEdits(
  items: ChecklistItem[],
  draft: Record<string, string>,
): Approval[] {
  return items.flatMap((item) => {
    if (item.status !== 'proposed' || item.tier === 'auto') return []
    const value = draft[item.id]
    if (item.tool === 'propose_crm_update' && value !== undefined) {
      return [{ id: item.id, tier: item.tier, edits: { value } }]
    }
    if (item.tool === 'create_follow_up' && value !== undefined) {
      return [{ id: item.id, tier: item.tier, edits: { note: value } }]
    }
    return [{ id: item.id, tier: item.tier }]
  })
}

export async function proposeVoiceNote(input: {
  transcript: string
  clientId: string
  leadId: string
}) {
  return sendAgentChat({
    text: input.transcript,
    sessionId: null,
    clientId: input.clientId,
    anchorContactId: null,
    anchorLeadId: input.leadId,
  })
}

export { approveChecklist }
