import { useSearchParams } from 'react-router-dom'
import { useClient } from '../../shell/ClientProvider'
import { EmptyState } from '../../ui/EmptyState'
import { Playbook } from './Playbook'

export function DocsStudio() {
  const { activeClient } = useClient()
  const canManage = activeClient?.role === 'manager' || activeClient?.role === 'client_admin' || activeClient?.role === 'super_admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const workspace: 'documents' | 'playbook' = searchParams.get('workspace') === 'playbook' ? 'playbook' : 'documents'

  const setWorkspace = (next: 'documents' | 'playbook') => {
    const params = new URLSearchParams(searchParams)
    if (next === 'playbook') params.set('workspace', 'playbook')
    else params.delete('workspace')
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="page-frame max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-fg">{workspace === 'documents' ? 'Documents' : 'Playbook'}</h1>
          <p className="mt-1 text-sm text-fg-muted">{workspace === 'documents' ? 'Quotations and other customer documents.' : canManage ? 'Review and maintain the company response to common objections.' : 'Company responses to common objections.'}</p>
        </div>
        <div className="flex rounded-md border border-border bg-surface-sunk p-0.5" role="tablist" aria-label="Docs workspace">
          {(['documents', 'playbook'] as const).map((item) => <button key={item} role="tab" aria-selected={workspace === item} onClick={() => setWorkspace(item)} className={['rounded-sm px-3 py-1.5 text-xs font-semibold capitalize', workspace === item ? 'bg-surface-raised text-fg shadow-elev-1' : 'text-fg-muted hover:text-fg'].join(' ')}>{item}</button>)}
        </div>
      </header>

      {workspace === 'playbook' ? <Playbook canManage={canManage} /> : (
        <EmptyState title="No documents yet." body="Quotations and other documents you create will appear here." />
      )}
    </div>
  )
}
