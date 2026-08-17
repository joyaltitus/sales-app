import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, LogOut, Search, WifiOff, Home, Inbox, Kanban, LayoutDashboard, FileText, Rows3, Sparkles } from 'lucide-react'
import { useClient } from './ClientProvider'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from './theme'
import { useOnline } from '../pwa/useOnline'
import { Chip } from '../ui/Chip'
import { AgentLauncher } from '../views/agent/AgentLauncher'
import { NotificationCenter } from '../ui/NotificationCenter'
import { ProductMark } from '../ui/ProductMark'
import { Sheet } from '../ui/Sheet'
import { OfflineBanner } from '../ui/OfflineBanner'

// Fixed shell header. Visible health (§C): AI/bot state + connection are always
// on screen — no silent failures.
export function TopBar() {
  const { clients, activeClient, setActiveClientId } = useClient()
  const { signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const online = useOnline()
  const desktopRole = activeClient?.role === 'manager' || activeClient?.role === 'client_admin' || activeClient?.role === 'super_admin'
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const destinations = useMemo(() => desktopRole ? [
    { label: 'Floor', detail: 'Live blockers and team decisions', to: '/', icon: Rows3 },
    { label: 'Inbox', detail: 'Customer conversations', to: '/inbox', icon: Inbox },
    { label: 'CRM', detail: 'Pipeline, follow-ups and tasks', to: '/crm', icon: Kanban },
    { label: 'Dashboard', detail: 'Operations, revenue and coaching', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Documents', detail: 'Quotes, proposals and playbook', to: '/docs', icon: FileText },
    { label: 'Sales copilot', detail: 'Prepare and review the next action', to: '/agent', icon: Sparkles },
  ] : [
    { label: 'Today', detail: 'Priorities, promises and target', to: '/', icon: Home },
    { label: 'Inbox', detail: 'Customer conversations', to: '/inbox', icon: Inbox },
    { label: 'Leads', detail: 'Pipeline, follow-ups and tasks', to: '/leads', icon: Kanban },
    { label: 'Documents', detail: 'Quotes, proposals and playbook', to: '/docs', icon: FileText },
    { label: 'Sales agent', detail: 'Prepare the next best action', to: '/agent', icon: Sparkles },
  ], [desktopRole])
  const visibleDestinations = destinations.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  const go = (to: string) => {
    navigate(to)
    setPaletteOpen(false)
    setQuery('')
  }

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface-glass px-3 backdrop-blur-xl sm:h-16 sm:px-4">
      <OfflineBanner />
      <ProductMark size={32} />
      <div className="min-w-0">
        {clients.length > 1 ? (
          <label className="block">
            <span className="sr-only">Workspace</span>
            <select
              value={activeClient?.id ?? ''}
              onChange={(event) => setActiveClientId(event.target.value)}
              className="block max-w-full truncate bg-transparent text-sm font-semibold tracking-[-0.015em] text-fg"
            >
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
        ) : (
          <span className="block truncate text-sm font-semibold tracking-[-0.015em] text-fg">
            {activeClient?.name ?? 'Sales App'}
          </span>
        )}
        <span className="hidden text-2xs text-fg-subtle sm:block">
          {desktopRole ? 'Sales operations' : 'Your workday'}
        </span>
      </div>

      {/* Only REAL signals render here (audit A7): the hardcoded "AI on" chip
          was a fake health indicator — removed until a real per-client
          bot-state read exists (PROPOSED-SUPERSESSION #3). */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button
            onClick={() => setPaletteOpen(true)}
            className="mr-2 hidden min-h-11 w-[min(28vw,280px)] items-center gap-2 rounded-md border border-border bg-surface-sunk px-3 text-left text-xs text-fg-muted shadow-[var(--inset-highlight)] transition-colors hover:border-border-strong lg:flex"
            title="Search or jump to a workspace"
            aria-label="Open workspace search"
          >
            <Search aria-hidden size={14} />
            <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
            <kbd className="rounded-xs border border-border-strong bg-surface px-1.5 py-0.5 text-2xs text-fg-subtle">⌘ K</kbd>
          </button>
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunk hover:text-fg"
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
          className="hidden min-h-11 items-center gap-1.5 rounded-md px-2 text-2xs font-medium text-fg-subtle hover:bg-surface-sunk hover:text-fg sm:flex"
        >
          <LogOut aria-hidden size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
      <Sheet open={paletteOpen} onClose={() => { setPaletteOpen(false); setQuery('') }} title="Search workspace">
        <label className="block">
          <span className="sr-only">Search destinations</span>
          <span className="relative block">
            <Search aria-hidden size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “follow-ups” or “report”" className="h-12 w-full rounded-md border border-border bg-surface-raised pr-3 pl-10 text-sm text-fg placeholder:text-fg-subtle" />
          </span>
        </label>
        <div className="mt-4 space-y-1">
          {visibleDestinations.map((item) => <button key={item.to} onClick={() => go(item.to)} className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-sunk"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent"><item.icon aria-hidden size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-fg">{item.label}</strong><span className="mt-0.5 block truncate text-xs text-fg-muted">{item.detail}</span></span></button>)}
          {visibleDestinations.length === 0 && <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-fg-muted">No workspace matches “{query}”.</p>}
        </div>
        <p className="mt-4 text-2xs text-fg-subtle">Navigation only · no customer data leaves this workspace.</p>
      </Sheet>
    </header>
  )
}
