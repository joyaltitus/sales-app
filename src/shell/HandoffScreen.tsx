import { Button } from '../ui/Button'
import { useAuth } from '../auth/AuthProvider'
import type { Role } from './ClientProvider'

// client_admin / super_admin config surfaces live in Workbench (MASTER-PLAN §A).
// Never a dead end — always a live link across.
const WORKBENCH_URL = import.meta.env.VITE_WORKBENCH_URL ?? 'https://workbench-admin.zeabur.app'

export function HandoffScreen({ role }: { role: Role }) {
  const { signOut } = useAuth()
  const who = role === 'super_admin' ? 'the founder panel' : 'your admin console'
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-lg font-semibold text-fg">Workspace access</h1>
        <p className="mb-5 text-sm text-fg-muted">
          Your role opens {who} in Workbench, not the Sales App.
        </p>
        <a href={WORKBENCH_URL} target="_blank" rel="noreferrer">
          <Button className="w-full">Open Workbench</Button>
        </a>
        <button
          onClick={signOut}
          className="mt-3 text-xs text-fg-subtle underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
