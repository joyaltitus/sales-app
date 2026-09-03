import { FileCheck2 } from 'lucide-react'
import { useClient } from '../../shell/ClientProvider'
import { useWaTemplates } from '../../lib/outbound-data'
import type { WaTemplate } from '../../lib/outbound-data'
import { Chip } from '../../ui/Chip'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'

// WHATSAPP TEMPLATES — the client's read-only view of what they can send.
//
// Read-only is a permission, not a design preference: `wa_templates_write` is
// super_admin. Workbench's version of this screen is a full editor because the
// operator uses it; the client sees the same rows with every write control gone
// rather than a set of buttons that all answer `denied`.
//
// Outside the 24-hour reply window WhatsApp allows only a template Meta has
// approved, so this list is the exact set of sentences that can start a
// conversation. Approval happens in Meta; registration happens in Workbench.

const statusTone = (s: string): 'success' | 'danger' | 'warn' =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warn'

/** Highest {{n}} in the body copy. When it disagrees with the registered
 *  variable count, pm_prepare_template_send rejects the send with
 *  `params_mismatch` — worth showing, since nobody can fix it from here and the
 *  alternative is a silent failure at send time. */
function maxPlaceholder(body: string | null): number {
  let hi = 0
  for (const m of (body ?? '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)) hi = Math.max(hi, Number(m[1]))
  return hi
}

function TemplateRow({ t }: { t: WaTemplate }) {
  const vars = t.variables ?? []
  const mismatch = maxPlaceholder(t.body_preview) !== vars.length
  return (
    <li className={['rounded-lg border border-border bg-surface p-3', t.active ? '' : 'opacity-55'].join(' ')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-fg">{t.template_name}</span>
        <Chip tone={statusTone(t.meta_status)}>{t.meta_status}</Chip>
        <Chip>{t.category}</Chip>
        <Chip>{t.language}</Chip>
        {!t.active && <Chip>inactive</Chip>}
      </div>
      {t.body_preview && (
        <p className="mt-2 text-xs whitespace-pre-wrap text-fg-muted">{t.body_preview}</p>
      )}
      <p className="mt-1.5 text-2xs text-fg-subtle">
        {vars.length === 0 ? 'No blanks to fill.' : `Blanks: ${vars.join(', ')}`}
        {mismatch && (
          <span className="ml-1.5 text-warn">
            — the wording has {maxPlaceholder(t.body_preview)} blank
            {maxPlaceholder(t.body_preview) === 1 ? '' : 's'} but {vars.length} are registered, so a
            send would be rejected.
          </span>
        )}
      </p>
    </li>
  )
}

export function Templates() {
  const { activeClient } = useClient()
  const clientId = activeClient?.id ?? null
  const { items, loading, error, reload } = useWaTemplates(clientId)

  if (!clientId) return <EmptyState title="No workspace" body="Pick a workspace to see its templates." />
  if (error) return <ErrorState title="Couldn't load templates." body={error} onRetry={() => void reload()} />

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-fg">Templates</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-muted">
          WhatsApp only lets you start a conversation with wording it has approved in advance. These
          are yours — pick one when you send a broadcast, or when a chat's 24-hour reply window has
          closed.
        </p>
      </header>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No templates yet"
          body="Your account manager registers templates once Meta approves them."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <TemplateRow key={t.id} t={t} />
          ))}
        </ul>
      )}

      <p className="border-t border-border pt-3 text-2xs text-fg-subtle">
        Templates are registered by your account manager.
      </p>
    </div>
  )
}
