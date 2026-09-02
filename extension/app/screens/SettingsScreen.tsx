import { useEffect, useState } from 'react'
import { ExternalLink, LogOut, MessageCircle, Monitor } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ChatMode } from '../../lib/contracts'
import { loadChatMode, saveChatMode } from '../chat-mode'
import { signOutExtension } from '../../lib/session'
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from '../../lib/prefs'
import { CACHE_KEYS, readCache } from '../../lib/cache'
import { HUB_URL } from '../../lib/panel-client'
import { ThemeToggle } from '../../ui/ThemeToggle'
import { Button } from '../../../src/ui/Button'

const OPTIONS: { value: ChatMode; label: string; icon: LucideIcon }[] = [
  { value: 'wa_me', label: 'WhatsApp Web', icon: MessageCircle },
  { value: 'desktop', label: 'Desktop', icon: Monitor },
]

const segment = (active: boolean) => [
  'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-sm border border-transparent text-sm transition-colors select-none',
  active ? 'bg-accent font-semibold text-accent-fg' : 'font-medium text-fg-muted hover:bg-surface hover:text-fg',
].join(' ')

const groupClass = 'flex gap-1 rounded-md border border-border bg-surface-sunk p-1'

export default function SettingsScreen({ clientId }: { clientId?: string }) {
  const [mode, setMode] = useState<ChatMode>('wa_me')
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [langs, setLangs] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    loadChatMode().then((stored) => {
      if (alive) setMode(stored)
    })
    void loadPrefs().then((stored) => { if (alive) setPrefs(stored) })
    // Dialects come from the library the panel already cached. Settings is not
    // a screen worth a network read: opening it must never be what fetches the
    // playbook for the first time.
    void readCache(CACHE_KEYS.library).then((entry) => {
      if (!alive || !entry || (clientId && entry.scope !== clientId)) return
      const found = new Set<string>()
      for (const script of entry.data.scripts) for (const code of script.langs) found.add(code)
      const allowed = entry.data.config?.languages
      setLangs([...found].filter((code) => !allowed?.length || allowed.includes(code)))
    })
    return () => {
      alive = false
    }
  }, [clientId])

  async function choose(next: ChatMode) {
    setMode(next)
    await saveChatMode(next)
  }

  /** Rep-local only. Anything the whole team shares — the standard script, the
   *  UPI id, which dialects exist — is a Sales Hub setting, not a panel one. */
  async function patch(next: Partial<Prefs>) {
    setPrefs((current) => ({ ...current, ...next }))
    await savePrefs(next)
  }

  return (
    <section className="flex flex-col gap-3 p-4">
      <h1 className="label-caps">Open chats in</h1>
      <div role="group" aria-label="Chat mode" className="flex gap-1 rounded-md border border-border bg-surface-sunk p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = mode === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => void choose(value)}
              className={[
                'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-sm border border-transparent text-sm transition-colors select-none',
                active
                  ? 'bg-accent font-semibold text-accent-fg'
                  : 'font-medium text-fg-muted hover:bg-surface hover:text-fg',
              ].join(' ')}
            >
              <Icon aria-hidden size={15} strokeWidth={1.9} />
              {label}
            </button>
          )
        })}
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">
        WhatsApp Web keeps the panel visible beside the chat; desktop mode switches you out of the
        browser.
      </p>

      <h1 className="label-caps mt-2">Scripts</h1>
      {langs.length > 1 && (
        <>
          <span className="text-xs text-fg-muted">Default dialect</span>
          <div role="group" aria-label="Default dialect" className={groupClass}>
            {langs.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={(prefs.defaultLang ?? langs[0]) === code}
                onClick={() => void patch({ defaultLang: code })}
                className={segment((prefs.defaultLang ?? langs[0]) === code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
      <span className="text-xs text-fg-muted">Open scripts on</span>
      <div role="group" aria-label="Default wording" className={groupClass}>
        <button type="button" aria-pressed={!prefs.useMine} onClick={() => void patch({ useMine: false })} className={segment(!prefs.useMine)}>
          Company standard
        </button>
        <button type="button" aria-pressed={prefs.useMine} onClick={() => void patch({ useMine: true })} className={segment(prefs.useMine)}>
          My version
        </button>
      </div>
      <label className="flex min-h-11 items-center gap-2.5 text-sm text-fg">
        <input
          type="checkbox"
          checked={prefs.showRoadmap}
          onChange={(event) => void patch({ showRoadmap: event.target.checked })}
          className="size-4 accent-[var(--accent)]"
        />
        Show the call roadmap when a lead opens
      </label>
      <label className="flex min-h-11 items-center gap-2.5 text-sm text-fg">
        <input
          type="checkbox"
          checked={prefs.openCallsInTab}
          onChange={(event) => void patch({ openCallsInTab: event.target.checked })}
          className="size-4 accent-[var(--accent)]"
        />
        Offer “Open in tab” on a lead
      </label>
      <p className="-mt-1 text-xs leading-relaxed text-fg-subtle">
        Opens the playbook in its own browser tab, with the roadmap and the objections side by
        side instead of stacked, and 1–9 on the keyboard for objections. The panel keeps working
        exactly the same way.
      </p>
      <a
        href={`${HUB_URL}/more`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        Manage my script voice and company settings in Sales Hub
        <ExternalLink aria-hidden size={12} strokeWidth={2} />
      </a>

      <h1 className="label-caps mt-2">Appearance</h1>
      <ThemeToggle />
      <Button variant="secondary" className="mt-2 min-h-11 w-full" onClick={() => void signOutExtension()}>
        <LogOut aria-hidden size={15} strokeWidth={1.9} />
        Sign out
      </Button>
    </section>
  )
}
