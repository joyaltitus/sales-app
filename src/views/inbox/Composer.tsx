import { useCallback, useEffect, useRef, useState } from 'react'
import { SendHorizontal, Sparkles, Trash2, Zap } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { sendAgentMessage } from '../../lib/api'
import { clearGatewayKey, hasConfiguredGatewayKey, loadGatewayKey, saveGatewayKey } from '../../lib/gateway-key'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import { ObjectionCapture } from '../objections/ObjectionCapture'
import { useAuth } from '../../auth/AuthProvider'
import { useClient } from '../../shell/ClientProvider'
import { supabase } from '../../lib/supabase'

// SA-06 quick replies — the retype-killer. Wired to the `quick_replies` table
// (client_id, title, body, scope 'personal'|'team', created_by, active).
// Saved from the current draft, inserted into the input (the human still
// edits + sends — nothing auto-sends). `title` isn't captured by this UI, so
// the body doubles as the title (truncated) — the picker only ever shows the
// body text anyway. No migration of prior localStorage values: the old
// `sales-app.quick-replies` key is simply no longer read.
const QUICK_REPLY_LIMIT = 30

type QuickReply = { id: string; body: string; scope: 'personal' | 'team' }

function useQuickReplies(clientId: string | null, userId: string | null) {
  const [items, setItems] = useState<QuickReply[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('quick_replies')
      .select('id, body, scope')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(QUICK_REPLY_LIMIT)
    setItems((data ?? []) as QuickReply[])
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (body: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!clientId || !userId) return { ok: false, message: 'No active workspace.' }
    const title = body.length > 60 ? `${body.slice(0, 57)}...` : body
    const { error } = await supabase.from('quick_replies').insert({
      client_id: clientId,
      title,
      body,
      scope: 'personal',
      created_by: userId,
    })
    if (error) return { ok: false, message: error.message }
    void load()
    return { ok: true }
  }

  const remove = async (id: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!clientId) return { ok: false, message: 'No active workspace.' }
    const { error } = await supabase.from('quick_replies').delete().eq('client_id', clientId).eq('id', id)
    if (error) return { ok: false, message: error.message }
    void load()
    return { ok: true }
  }

  return { items, loading, save, remove }
}

// The composer. `messages` INSERT policies are empty, so the browser CANNOT
// write the row — every reply goes through POST /api/agent-send. There is no
// shortcut and none should be invented (direction §0.4).
//
// Copy follows §1.9: an action keeps its name end to end, errors say what
// happened and what to do, and nothing apologises.

/** Retained for any future role that may read a thread without answering it.
 *  As of SA-01c every role hub-service accepts through the gateway — agent,
 *  manager, client_admin, super_admin — can send, so nothing passes canSend
 *  false today. Kept because "can read but not reply" is a real state this UI
 *  should degrade into rather than render a button that always 403s. */
function ReadOnlyNotice() {
  return (
    <div className="border-t border-border bg-surface px-4 py-3 text-xs text-fg-muted">
      Replying isn't enabled for your role. Open the thread on a rep's account to answer.
    </div>
  )
}

function OptedOutNotice() {
  return (
    <div className="border-t border-border bg-surface px-4 py-3 text-xs text-warn">
      This contact has opted out of messages. Outbound replies are disabled.
    </div>
  )
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string; unauthorized?: boolean; configuredAccess?: boolean }

// Every failure the hub-service matrix can produce, in the rep's words. Never
// name the machinery: no status codes, no route names, no `PM_GATEWAY_KEY`.
function explain(kind: string, configuredAccess: boolean): string {
  switch (kind) {
    case 'unauthorized':
      if (configuredAccess) {
        return 'Workspace access is unavailable. Ask your admin to update the app configuration.'
      }
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
  contactId,
  canSend,
  isOptedOut = false,
  onSent,
  seed,
  onOptimisticSend = () => '',
  onOptimisticSettle = () => {},
}: {
  conversationId: string
  contactId: string
  canSend: boolean
  isOptedOut?: boolean
  onSent: () => void
  /** SA-05: AI draft from the context rail. Counter-keyed so the same draft
   *  can be pushed twice; it seeds the input, the human still edits + sends. */
  seed?: { n: number; text: string } | null
  /** S1 (issue #15): paint a pending bubble immediately, before the network
   *  call resolves. Returns the bubble's tempId for onOptimisticSettle. */
  onOptimisticSend?: (body: string) => string
  /** S1: flips the bubble to failed on any non-ok result (including no_key,
   *  which never reached the network); leaves it pending on ok — only an
   *  authoritative row may claim sent/delivered/read. */
  onOptimisticSettle?: (tempId: string, ok: boolean) => void
}) {
  const { session } = useAuth()
  const { activeClient } = useClient()
  const [text, setText] = useState('')
  const [state, setState] = useState<SendState>({ kind: 'idle' })
  useEffect(() => {
    if (!seed) return
    if (text.trim() && text !== seed.text) {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const ok = window.confirm('Replace your typed message with the AI draft?')
        if (!ok) return
      }
    }
    setText(seed.text)
  }, [seed])
  const [needsKey, setNeedsKey] = useState(!loadGatewayKey())
  const [keyDraft, setKeyDraft] = useState('')
  const keyInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (needsKey) keyInputRef.current?.focus()
  }, [needsKey])
  const { items: replies, save: saveReply, remove: removeReply } = useQuickReplies(
    activeClient?.id ?? null,
    session?.user.id ?? null,
  )
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  if (isOptedOut) return <OptedOutNotice />
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
            ref={keyInputRef}
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
    // S1: paint the bubble and clear the input before the network call
    // resolves — click-to-pending must not wait on a round trip.
    const tempId = onOptimisticSend(body)
    setText('')
    setState({ kind: 'sending' })

    const res = await sendAgentMessage(conversationId, body)
    onOptimisticSettle(tempId, res.kind === 'ok')

    if (res.kind === 'ok') {
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
    const configuredAccess = hasConfiguredGatewayKey()
    setState({
      kind: 'error',
      message: explain(res.kind, configuredAccess),
      unauthorized: res.kind === 'unauthorized',
      configuredAccess,
    })
  }

  return (
    <div className="border-t border-border bg-surface-glass backdrop-blur-xl">
      {state.kind === 'error' && (
        <div
          role="alert"
          aria-live="assertive"
          className="border-b border-border bg-danger-subtle px-4 py-2 text-xs text-danger"
        >
          {state.message}
          {state.unauthorized && !state.configuredAccess && (
            <Button
              size="sm"
              onClick={() => {
                clearGatewayKey()
                setKeyDraft('')
                setNeedsKey(true)
                setState({ kind: 'idle' })
              }}
              className="ml-2"
            >
              Replace access key
            </Button>
          )}
        </div>
      )}

      <ObjectionCapture
        contactId={contactId}
        conversationId={conversationId}
        source="chat"
        detected="price"
        compact
        onInsertScript={(script) => {
          setText(script)
          setState({ kind: 'idle' })
        }}
      />

      {/* Quick replies — tap to insert; save the current draft for next time. */}
      {repliesOpen && (
        <div className="max-h-48 space-y-1 overflow-y-auto border-b border-border bg-surface px-4 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="label-caps text-fg-subtle">Quick replies</span>
            <span className="text-2xs text-fg-subtle">Personal + team</span>
          </div>
          {replyError && <p className="py-1 text-xs font-semibold text-danger">{replyError}</p>}
          {replies.length === 0 && !replyError && (
            <p className="py-1 text-xs text-fg-subtle">
              None yet. Type a reply below, then Save as quick reply.
            </p>
          )}
          {replies.map((r) => (
            <div key={r.id} className="group flex items-center gap-2">
              <button
                onClick={() => {
                  setText(r.body)
                  setRepliesOpen(false)
                }}
                className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs text-fg hover:bg-surface-sunk"
              >
                {r.scope === 'team' && <span className="mr-1 text-2xs text-fg-subtle">Team ·</span>}
                {r.body}
              </button>
              <button
                onClick={() => {
                  void removeReply(r.id).then((res) => setReplyError(res.ok ? null : res.message))
                }}
                aria-label="Delete quick reply"
                className="shrink-0 rounded-sm p-1 text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-danger"
              >
                <Trash2 aria-hidden size={13} strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {text.trim() && !replies.some((r) => r.body === text.trim()) && (
            <button
              onClick={() => {
                void saveReply(text.trim()).then((res) => setReplyError(res.ok ? null : res.message))
              }}
              className="w-full rounded-md border border-dashed border-border-strong px-2 py-1.5 text-left text-xs text-fg-muted hover:text-fg"
            >
              Save current draft as quick reply
            </button>
          )}
        </div>
      )}

      {seed && text === seed.text && (
        <div className="flex items-center gap-2 border-b border-border bg-accent-subtle px-4 py-2 text-2xs text-fg-muted">
          <Sparkles aria-hidden size={13} className="text-accent" /> AI draft added — review before sending.
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-3 sm:px-4">
        <button
          onClick={() => setRepliesOpen((o) => !o)}
          aria-label="Quick replies"
          aria-expanded={repliesOpen}
          title="Quick replies"
          className={[
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors',
            repliesOpen
              ? 'border-transparent bg-accent-subtle text-accent'
              : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
          ].join(' ')}
        >
          <Zap aria-hidden size={15} strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-raised p-1 shadow-[var(--inset-highlight)] focus-within:border-accent">
          <textarea
            aria-label="Type a reply"
            placeholder="Message customer…"
            rows={1}
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
            className="max-h-28 min-h-9 w-full resize-none bg-transparent px-2 py-2 text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <div className="shrink-0">
          <VoiceButton onTranscript={setText} compact />
        </div>
        {/* The accent is reserved for exactly one thing per screen: the next
            action (§1.7). On this screen that is Send, and nothing else. */}
        <Button size="icon" onClick={() => void send()} disabled={!text.trim() || state.kind === 'sending'} aria-label="Send message">
          {state.kind === 'sending' ? <span className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent" /> : <SendHorizontal aria-hidden size={17} />}
        </Button>
      </div>
    </div>
  )
}
