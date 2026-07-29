import { useState } from 'react'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { sendAgentMessage } from '../../lib/api'
import { loadGatewayKey, saveGatewayKey } from '../../lib/gateway-key'

// The composer. `messages` INSERT policies are empty, so the browser CANNOT
// write the row — every reply goes through POST /api/agent-send. There is no
// shortcut and none should be invented (direction §0.4).
//
// Copy follows §1.9: an action keeps its name end to end, errors say what
// happened and what to do, and nothing apologises.

/** hub-service's TENANT_ROLES is ['agent','client_admin','super_admin'] — the
 *  `manager` role is NOT in it (hub-service src/api/auth.ts:13), so a manager's
 *  send would come back 403. Rather than put a dead button in front of a user,
 *  the manager composer is explicitly read-only and says why. Widening
 *  TENANT_ROLES is an authorization change and belongs to its own src/api/
 *  session with its own auth review (Joyal's ruling, SA-01b). */
function ReadOnlyNotice() {
  return (
    <div className="border-t border-border bg-surface px-4 py-3 text-xs text-fg-muted">
      Replying isn't enabled for managers yet. Open the thread on a rep's account to answer.
    </div>
  )
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }

// Every failure the hub-service matrix can produce, in the rep's words. Never
// name the machinery: no status codes, no route names, no `PM_GATEWAY_KEY`.
function explain(kind: string): string {
  switch (kind) {
    case 'unauthorized':
      return 'Your session or access key was rejected. Sign out and back in, then try again.'
    case 'forbidden':
      return "You don't have permission to reply on this conversation."
    case 'not_found':
      return 'This conversation has no reply route set up yet. Ask your admin to connect the WhatsApp number.'
    case 'paused':
      return 'Replies are paused right now. Try again shortly.'
    case 'unavailable':
      return 'The message service is unreachable. Try again shortly.'
    case 'bad_request':
      return "That message couldn't be sent as written."
    case 'no_session':
      return 'Your session expired. Sign in again.'
    default:
      return "Reply didn't send. Check connection and try again."
  }
}

export function Composer({
  conversationId,
  canSend,
  onSent,
}: {
  conversationId: string
  canSend: boolean
  onSent: () => void
}) {
  const [text, setText] = useState('')
  const [state, setState] = useState<SendState>({ kind: 'idle' })
  const [needsKey, setNeedsKey] = useState(!loadGatewayKey())
  const [keyDraft, setKeyDraft] = useState('')

  if (!canSend) return <ReadOnlyNotice />

  // The gateway key is anti-noise defence-in-depth, not a wall, and anything
  // shipped to a browser is public — so it is pasted once and kept in
  // localStorage, exactly as Workbench does it. Inline, because a primary action
  // never hides behind a modal (§1.10 #12) and the first cut has no Settings
  // screen (§1.10 #15).
  if (needsKey) {
    return (
      <div className="flex flex-col gap-2 border-t border-border bg-surface px-4 py-3">
        <label htmlFor="gwkey" className="text-xs text-fg-muted">
          Paste your workspace access key once to enable replies on this device.
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="gwkey"
            type="password"
            autoComplete="off"
            placeholder="Access key"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
          />
          <Button
            onClick={() => {
              if (!keyDraft.trim()) return
              saveGatewayKey(keyDraft)
              setKeyDraft('')
              setNeedsKey(false)
            }}
          >
            Save
          </Button>
        </div>
      </div>
    )
  }

  const send = async () => {
    const body = text.trim()
    if (!body || state.kind === 'sending') return
    setState({ kind: 'sending' })

    const res = await sendAgentMessage(conversationId, body)

    if (res.kind === 'ok') {
      setText('')
      setState({ kind: 'sent' })
      // The row is written server-side by the send worker, so the thread is
      // reconciled by refetch (and by the realtime INSERT) rather than by
      // trusting an optimistic local copy. An optimistic bubble that never
      // reconciles is a lie the UI tells itself.
      onSent()
      return
    }
    if (res.kind === 'no_key') {
      setNeedsKey(true)
      setState({ kind: 'idle' })
      return
    }
    setState({ kind: 'error', message: explain(res.kind) })
  }

  return (
    <div className="border-t border-border bg-surface">
      {state.kind === 'error' && (
        <div className="border-b border-border bg-danger-subtle px-4 py-2 text-xs text-danger">
          {state.message}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-3">
        <Input
          aria-label="Type a reply"
          placeholder="Type a reply"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (state.kind !== 'idle') setState({ kind: 'idle' })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        {/* The accent is reserved for exactly one thing per screen: the next
            action (§1.7). On this screen that is Send, and nothing else. */}
        <Button onClick={() => void send()} disabled={!text.trim() || state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Sending' : state.kind === 'sent' ? 'Sent' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
