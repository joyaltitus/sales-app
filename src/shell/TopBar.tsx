import { Sun, Moon, LogOut, Search, WifiOff } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from './theme'
import { useOnline } from '../pwa/useOnline'
import { Chip } from '../ui/Chip'
import { AgentLauncher } from '../views/agent/AgentLauncher'
import { NotificationCenter } from '../ui/NotificationCenter'
import { ProductMark } from '../ui/ProductMark'

// Fixed shell header. Visible health (§C): AI/bot state + connection are always
// on screen — no silent failures.
export function TopBar() {
  const { activeClient } = useClient()
  const { signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const online = useOnline()
  const desktopRole = activeClient?.role === 'manager' || activeClient?.role === 'client_admin'

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface-glass px-3 backdrop-blur-xl sm:h-16 sm:px-4">
      <ProductMark size={32} />
      <div className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-[-0.015em] text-fg">
          {activeClient?.name ?? 'Sales App'}
        </span>
        <span className="hidden text-2xs text-fg-subtle sm:block">
          {desktopRole ? 'Sales operations' : 'Your workday'}
        </span>
      </div>

      {/* Only REAL signals render here (audit A7): the hardcoded "AI on" chip
          was a fake health indicator — removed until a real per-client
          bot-state read exists (PROPOSED-SUPERSESSION #3). */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {desktopRole && (
          <button
            className="mr-2 hidden h-9 w-[min(28vw,280px)] items-center gap-2 rounded-md border border-border bg-surface-sunk px-3 text-left text-xs text-fg-muted shadow-[var(--inset-highlight)] transition-colors hover:border-border-strong lg:flex"
            title="Command palette preview — not wired"
            aria-label="Open command palette, not wired"
          >
            <Search aria-hidden size={14} />
            <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
            <kbd className="rounded-xs border border-border-strong bg-surface px-1.5 py-0.5 text-2xs text-fg-subtle">⌘ K</kbd>
          </button>
        )}
        <AgentLauncher />
        <NotificationCenter />
        {!online && (
          <Chip tone="warn" aria-live="polite" title="Connection lost">
            <WifiOff aria-hidden size={12} />
            <span className="hidden sm:inline">Reconnecting…</span>
          </Chip>
        )}
        <button
          onClick={toggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunk hover:text-fg"
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
          className="hidden h-9 items-center gap-1.5 rounded-md px-2 text-2xs font-medium text-fg-subtle hover:bg-surface-sunk hover:text-fg sm:flex"
        >
          <LogOut aria-hidden size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </header>
  )
}
