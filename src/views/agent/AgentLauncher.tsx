import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Sheet } from '../../ui/Sheet'

const AgentPanel = lazy(() => import('./AgentPanel').then((module) => ({ default: module.AgentPanel })))

// One door to the agent from anywhere in the shell: desktop opens the
// slide-over next to the work; phone navigates to the full-screen /agent
// route (voice + approvals want the whole screen there).
export function AgentLauncher() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const launch = () => {
    if (window.matchMedia('(min-width: 640px)').matches) setOpen(true)
    else navigate('/agent')
  }

  return (
    <>
      <button
        onClick={launch}
        className="flex h-9 items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-accent-subtle px-2.5 text-2xs font-semibold text-accent hover:bg-accent-soft"
        aria-label="Open AI sales agent"
      >
        <Sparkles aria-hidden size={14} strokeWidth={2} />
        Agent
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Sales agent">
        <div className="-m-4 h-[calc(100vh-3.25rem)] sm:h-[calc(100vh-3.25rem)]">
          <Suspense fallback={<div className="p-4 text-xs text-fg-muted">Loading copilot…</div>}><AgentPanel /></Suspense>
        </div>
      </Sheet>
    </>
  )
}

/** Full-screen phone surface (route /agent). */
export function AgentScreen() {
  return (
    <div className="h-full">
      <Suspense fallback={<div className="p-4 text-xs text-fg-muted">Loading copilot…</div>}><AgentPanel /></Suspense>
    </div>
  )
}
