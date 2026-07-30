import { Sun, Moon, LogOut } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from './theme'
import { useOnline } from '../pwa/useOnline'
import { Chip } from '../ui/Chip'

// Fixed shell header. Visible health (§C): AI/bot state + connection are always
// on screen — no silent failures.
export function TopBar() {
  const { activeClient } = useClient()
  const { signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const online = useOnline()

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <span className="truncate text-sm font-semibold text-fg">
        {activeClient?.name ?? 'Sales App'}
      </span>

      {/* Bot/AI health — placeholder wiring lands with the inbox epic. */}
      <Chip tone="success" className="ml-1">
        AI on
      </Chip>

      <div className="ml-auto flex items-center gap-2">
        {!online && (
          <Chip tone="warn" aria-live="polite">
            Reconnecting…
          </Chip>
        )}
        <button
          onClick={toggle}
          className="rounded-sm p-1.5 text-fg-muted hover:bg-surface-sunk"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun aria-hidden size={16} strokeWidth={1.75} />
          ) : (
            <Moon aria-hidden size={16} strokeWidth={1.75} />
          )}
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-2xs font-medium text-fg-subtle hover:bg-surface-sunk"
        >
          <LogOut aria-hidden size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </header>
  )
}
