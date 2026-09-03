import {
  approveChecklist,
  sendAgentChat,
  type Approval,
  type ChecklistItem,
} from '@app/lib/agent-chat'
import type { ProposedField } from '../ui/VoiceCard'

// The transcribe call moved to @app/lib/api so the web app can use it too — the
// import only crosses this way (extension -> src), never back. Re-exported here
// so every existing caller keeps its import path.
export { TRANSCRIBE_PATH, transcribeNote, type TranscribeResponse } from '@app/lib/api'

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
