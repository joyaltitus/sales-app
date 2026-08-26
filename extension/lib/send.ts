import { sendAgentMessage } from '@app/lib/api'

/** Sending is never queued: offline is an immediate, visible failure. */
export async function sendNow(conversationId: string, text: string) {
  if (!navigator.onLine) return { kind: 'offline' as const }
  return sendAgentMessage(conversationId, text)
}
