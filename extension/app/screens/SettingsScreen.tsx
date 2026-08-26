import { useEffect, useState } from 'react'
import type { ChatMode } from '../../lib/contracts'
import { loadChatMode, saveChatMode } from '../chat-mode'

const OPTIONS: { value: ChatMode; label: string }[] = [
  { value: 'wa_me', label: 'wa.me' },
  { value: 'desktop', label: 'Desktop' },
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
    <section style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="label-caps" style={{ margin: 0 }}>Open chats in</h1>
      <div
        role="group"
        aria-label="Chat mode"
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-sunk)',
        }}
      >
        {OPTIONS.map((option) => {
          const active = mode === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(option.value)}
              style={{
                height: 44,
                flex: 1,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 650 : 500,
                cursor: 'pointer',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent-fg)' : 'var(--fg-muted)',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', lineHeight: 1.65, color: 'var(--fg-muted)' }}>
        wa.me keeps the panel visible beside the chat; desktop mode is faster but switches you out
        of the browser.
      </p>
    </section>
  )
}
