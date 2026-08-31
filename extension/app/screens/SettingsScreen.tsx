import { useEffect, useState } from 'react'
import { LogOut, MessageCircle, Monitor } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ChatMode } from '../../lib/contracts'
import { loadChatMode, saveChatMode } from '../chat-mode'
import { signOutExtension } from '../../lib/session'
import { Button } from '../../../src/ui/Button'

const OPTIONS: { value: ChatMode; label: string; icon: LucideIcon }[] = [
  { value: 'wa_me', label: 'WhatsApp Web', icon: MessageCircle },
  { value: 'desktop', label: 'Desktop', icon: Monitor },
]

export default function SettingsScreen() {
  const [mode, setMode] = useState<ChatMode>('wa_me')

  useEffect(() => {
    let alive = true
    loadChatMode().then((stored) => {
      if (alive) setMode(stored)
    })
    return () => {
      alive = false
    }
  }, [])

  async function choose(next: ChatMode) {
    setMode(next)
    await saveChatMode(next)
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
      <Button variant="secondary" className="mt-2 min-h-11 w-full" onClick={() => void signOutExtension()}>
        <LogOut aria-hidden size={15} strokeWidth={1.9} />
        Sign out
      </Button>
    </section>
  )
}
