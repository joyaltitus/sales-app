import { useState } from 'react'
import { Lock, PackageSearch, TriangleAlert } from 'lucide-react'
import { useProducts, saveProduct, deactivateRecord, honestyLint } from '../../lib/manage-data'
import type { Product } from '../../lib/manage-data'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Input } from '../../ui/Input'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { HistoryButton, HistoryDrawer } from './HistoryDrawer'
import { HonestyNotes, RefsNote, WriteFailure } from './shared'
import type { TabProps } from './shared'

// Products (`items`) — name, price, description, sell-notes, deactivate.
//
// `slug` is shown and never editable: manifests and media bundles reference it,
// and 069's tg_items_lock_slug raises on a browser change whoever you are short
// of super_admin. It is rendered rather than hidden because an operator asking
// "which product is this in the export?" deserves the answer.

function ProductCard({
  product,
  clientId,
  userId,
  names,
  onChanged,
}: {
  product: Product
  clientId: string
  userId: string | null
  names: Map<string, string>
  onChanged: () => void
}) {
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))
  const [description, setDescription] = useState(product.description ?? '')
  const [aiInstruction, setAiInstruction] = useState(product.ai_instruction ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [refs, setRefs] = useState<{ kind: string; ref: string }[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Advisory, never a wall — the send-path guardrail is the real authority on
  // what reaches a customer. Both guest-facing fields are linted.
  const warnings = [...honestyLint(description), ...honestyLint(aiInstruction)]
  const priceValue = Number(price)
  const priceValid = price.trim() !== '' && Number.isFinite(priceValue) && priceValue >= 0
  const dirty =
    name !== product.name ||
    price !== String(product.price) ||
    description !== (product.description ?? '') ||
    aiInstruction !== (product.ai_instruction ?? '')

  const save = async () => {
    if (!priceValid || name.trim() === '') return
    setBusy(true)
    setFailure(null)
    const res = await saveProduct(clientId, product.id, {
      name: name.trim(),
      category: product.category,
      description: description.trim() || null,
      price: priceValue,
      ai_instruction: aiInstruction.trim() || null,
    })
    setBusy(false)
    if (res.ok) onChanged()
    else setFailure(res.code)
  }

  const deactivate = async () => {
    if (!userId) return
    setBusy(true)
    setFailure(null)
    setRefs(null)
    const res = await deactivateRecord(clientId, 'item', product.slug, userId)
    setBusy(false)
    if (!res.ok) {
      setFailure(res.code)
      return
    }
    setRefs(res.refs)
    onChanged()
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-caps flex items-center gap-1.5 text-fg-subtle">
          <Lock aria-hidden size={11} /> {product.slug}
        </span>
        {!product.active && <Chip tone="neutral">Deactivated</Chip>}
        <div className="ml-auto flex items-center gap-1">
          <HistoryButton onClick={() => setHistoryOpen(true)} />
          {product.active && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void deactivate()}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="block">
          <span className="label-caps">Name</span>
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="label-caps">Price</span>
          <Input
            className="mt-1"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={!priceValid}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="label-caps">Description</span>
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className="mt-3 block">
        <span className="label-caps">Sell notes for the assistant</span>
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg"
          value={aiInstruction}
          onChange={(e) => setAiInstruction(e.target.value)}
        />
        <span className="mt-1 block text-2xs text-fg-subtle">
          How the assistant should pitch this. Customers never see this text directly.
        </span>
      </label>

      <HonestyNotes warnings={warnings} />
      {!priceValid && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-danger" role="alert">
          <TriangleAlert aria-hidden size={13} /> Price must be a number, zero or above.
        </p>
      )}
      <RefsNote refs={refs} noun="product" />
      {failure ? <WriteFailure code={failure} /> : null}

      <div className="mt-3 flex justify-end">
        <Button disabled={!dirty || !priceValid || busy} loading={busy} onClick={() => void save()}>
          Save changes
        </Button>
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        clientId={clientId}
        userId={userId}
        tableName="items"
        recordPk={product.id}
        title={product.name}
        names={names}
        onReverted={onChanged}
      />
    </article>
  )
}

export function ProductsTab({ clientId, userId, names, preview }: TabProps<Product>) {
  const live = useProducts(preview ? null : clientId)
  const items = preview ?? live.items

  if (live.error && !preview) {
    return <ErrorState title="Couldn't load your products." body={live.error} onRetry={live.reload} />
  }
  if (live.loading && !preview) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No products yet"
        body="Products come from your onboarding import. Ask us to add the first one."
      />
    )
  }

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          clientId={clientId}
          userId={userId}
          names={names}
          onChanged={live.reload}
        />
      ))}
    </div>
  )
}
