import { useEffect, useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import type { ChatMode } from '../lib/contracts'
import { loadChatMode, saveChatMode } from './chat-mode'
import {
  DEFAULT_PREFS,
  MAX_SNIPPETS,
  MAX_SNIPPET_CHARS,
  addSnippet,
  loadPrefs,
  loadSnippets,
  removeSnippet,
  savePrefs,
  type Prefs,
  type SavedSnippet,
} from '../lib/prefs'
import { panelSupabase } from '../lib/panel-client'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Button } from '../../src/ui/Button'
import { Input } from '../../src/ui/Input'

const APP_URL = import.meta.env.VITE_APP_URL as string | undefined
const IS_MAC = navigator.platform.toUpperCase().includes('MAC')

type Workspace = { id: string; name: string }

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-b border-border py-5 last:border-b-0">
      <h2 className="text-sm font-semibold tracking-[-0.015em] text-fg">{title}</h2>
      {hint && <p className="text-xs leading-relaxed text-fg-muted">{hint}</p>}
      {children}
    </section>
  )
}

export default function OptionsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [mode, setMode] = useState<ChatMode>('wa_me')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [snippets, setSnippets] = useState<SavedSnippet[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [snippetError, setSnippetError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all([loadPrefs(), loadChatMode(), loadSnippets()]).then(([storedPrefs, storedMode, storedSnippets]) => {
      if (!alive) return
      setPrefs(storedPrefs)
      setMode(storedMode)
      setSnippets(storedSnippets)
    })
    // The switcher only earns its place when the rep is actually in more than
    // one workspace, so the list is read before deciding to render it.
    void panelSupabase
      .from('user_client_memberships')
      .select('client_id, clients ( id, name )')
      .then(({ data }) => {
        if (!alive || !data) return
        const rows = data as unknown as { clients: Workspace | Workspace[] | null }[]
        setWorkspaces(
          rows
            .map((row) => (Array.isArray(row.clients) ? row.clients[0] : row.clients))
            .filter((client): client is Workspace => !!client),
        )
      })
    return () => { alive = false }
  }, [])

  function update(patch: Partial<Prefs>) {
    setPrefs((current) => ({ ...current, ...patch }))
    void savePrefs(patch).then(() => {
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    })
  }

  async function add() {
    const result = await addSnippet(title, body)
    if (!result.ok) { setSnippetError(result.message); return }
    setSnippets(result.snippets)
    setTitle('')
    setBody('')
    setSnippetError(null)
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-6">
      <header className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-[-0.035em] text-fg">Rep settings</h1>
        <span role="status" className={['text-2xs text-fg-subtle transition-opacity', saved ? 'opacity-100' : 'opacity-0'].join(' ')}>
          Saved
        </span>
      </header>

      <Section title="Open chats in" hint="WhatsApp Web keeps the panel beside the chat; Desktop switches you out of the browser.">
        <div role="group" aria-label="Chat mode" className="flex gap-1 rounded-md border border-border bg-surface-sunk p-1">
          {([['wa_me', 'WhatsApp Web'], ['desktop', 'Desktop']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => { setMode(value); void saveChatMode(value) }}
              className={[
                'min-h-11 flex-1 rounded-sm border border-transparent text-sm transition-colors select-none',
                mode === value ? 'bg-accent font-semibold text-accent-fg' : 'font-medium text-fg-muted hover:bg-surface hover:text-fg',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Appearance" hint="Applies to the side panel and this page. System follows your OS, including a scheduled switch.">
        <ThemeToggle />
      </Section>

      <Section title="Follow the open chat" hint="When on, the panel opens the lead for whichever chat you have in front of you. It never reads a chat you aren’t looking at, and never reads groups.">
        <label className="flex min-h-11 items-center gap-2.5">
          <input
            type="checkbox"
            checked={prefs.followChat}
            onChange={(event) => update({ followChat: event.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm text-fg">Follow chats by default</span>
        </label>
      </Section>

      <Section title="Quiet hours" hint="Follow-up and new-lead notifications are held during this window. Set both to the same time to switch quiet hours off.">
        <div className="flex flex-wrap items-center gap-2">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-fg-muted">From</span>
            <Input type="time" value={prefs.quietFrom} onChange={(event) => update({ quietFrom: event.target.value })} className="min-h-11" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-fg-muted">To</span>
            <Input type="time" value={prefs.quietTo} onChange={(event) => update({ quietTo: event.target.value })} className="min-h-11" />
          </label>
        </div>
      </Section>

      <Section title="Panel shortcut">
        <p className="text-xs leading-relaxed text-fg-muted">
          Press{' '}
          <kbd className="rounded-sm border border-border bg-surface-sunk px-1.5 py-0.5 text-2xs font-semibold text-fg">
            {IS_MAC ? '⌘ + Shift + 9' : 'Ctrl + Shift + 9'}
          </kbd>{' '}
          to open the panel. Change it at{' '}
          <span className="font-medium text-fg-muted">chrome://extensions/shortcuts</span> — Chrome does not let an
          extension rebind its own keys.
        </p>
      </Section>

      {workspaces.length > 1 && (
        <Section title="Workspace" hint="You belong to more than one. The panel loads the queue for this one.">
          <select
            value={prefs.activeClientId ?? workspaces[0]?.id ?? ''}
            onChange={(event) => update({ activeClientId: event.target.value })}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
        </Section>
      )}

      <Section title="Your snippets" hint={`Up to ${MAX_SNIPPETS}, ${MAX_SNIPPET_CHARS} characters each. Use {{name}} for the lead's name.`}>
        {snippets.length > 0 && (
          <ul className="grid gap-1.5">
            {snippets.map((snippet) => (
              <li key={snippet.id} className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{snippet.title}</span>
                  <span className="block text-xs leading-relaxed text-fg-muted">{snippet.body}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  aria-label={`Delete ${snippet.title}`}
                  onClick={() => void removeSnippet(snippet.id).then(setSnippets)}
                >
                  <Trash2 aria-hidden size={15} strokeWidth={1.9} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 rounded-md border border-border bg-surface-sunk p-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Name, e.g. Fee structure" className="min-h-11" />
          <textarea
            value={body}
            maxLength={MAX_SNIPPET_CHARS}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Hi {{name}}, here's the fee structure…"
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-fg"
          />
          {snippetError && <p role="alert" className="text-xs text-danger">{snippetError}</p>}
          <div className="flex items-center gap-2">
            <span className="text-2xs text-fg-subtle tnum">{body.length}/{MAX_SNIPPET_CHARS}</span>
            <Button className="ml-auto min-h-11" disabled={snippets.length >= MAX_SNIPPETS} onClick={() => void add()}>
              Add snippet
            </Button>
          </div>
        </div>
      </Section>

      {APP_URL && (
        <Section title="Web app">
          <a
            href={`${APP_URL.replace(/\/$/, '')}/leads`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Open the full CRM
            <ExternalLink aria-hidden size={14} strokeWidth={1.9} />
          </a>
        </Section>
      )}
    </main>
  )
}
