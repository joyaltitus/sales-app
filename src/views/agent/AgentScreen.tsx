import { lazy, Suspense } from 'react'

const AgentPanel = lazy(() => import('./AgentPanel').then((module) => ({ default: module.AgentPanel })))

/** Full-screen phone surface (route /agent). */
export function AgentScreen() {
  return (
    <div className="h-full">
      <Suspense fallback={<div className="p-4 text-xs text-fg-muted">Loading copilot…</div>}>
        <AgentPanel />
      </Suspense>
    </div>
  )
}
