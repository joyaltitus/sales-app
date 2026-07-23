import { useState } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { Chip } from './Chip'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { ListRow } from './ListRow'
import { Sheet } from './Sheet'
import { ToastProvider, useToast } from './Toast'
import { useTheme } from '../shell/theme'

// Dev route: every primitive × its six control states (§C). Also the dark-mode
// smoke test — toggle flips cleanly, no unstyled flashes.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-6">
      <h2 className="label-caps mb-3">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  )
}

function Inner() {
  const { theme, toggle } = useTheme()
  const { show } = useToast()
  const [sheet, setSheet] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Kitchen sink</h1>
        <Button variant="secondary" size="sm" onClick={toggle}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
      </div>

      <Section title="Button — variants">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </Section>

      <Section title="Button — six states (hover/focus/active/disabled/loading + empty label)">
        <Button>Default</Button>
        <Button className="bg-accent-hover">Hover</Button>
        <Button className="bg-accent-active">Active</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button aria-label="icon only">·</Button>
      </Section>

      <Section title="Input — default / hover / focus / disabled / invalid / loading">
        <Input placeholder="Default" />
        <Input placeholder="Hover me" />
        <Input placeholder="Focus me" autoFocus />
        <Input placeholder="Disabled" disabled />
        <Input placeholder="Invalid" invalid defaultValue="bad@" />
        <div className="flex items-center gap-2">
          <Input placeholder="Loading" />
          <Skeleton className="h-4 w-4 rounded-pill" />
        </div>
      </Section>

      <Section title="Chip — tones">
        <Chip>Neutral</Chip>
        <Chip tone="accent">Accent</Chip>
        <Chip tone="success">AI on</Chip>
        <Chip tone="warn">Overdue</Chip>
        <Chip tone="danger">Failed</Chip>
      </Section>

      <Section title="Skeleton">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </Section>

      <Section title="Toast (optimistic rollback)">
        <Button variant="secondary" onClick={() => show('Saved', 'success')}>
          Success toast
        </Button>
        <Button variant="secondary" onClick={() => show('Send failed — retrying', 'danger')}>
          Error toast
        </Button>
      </Section>

      <Section title="Sheet">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Open sheet
        </Button>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Lead panel">
          <p className="text-sm text-fg-muted">Context panel content.</p>
        </Sheet>
      </Section>

      <Section title="EmptyState">
        <div className="w-full">
          <EmptyState
            title="No leads yet"
            body="Share your WhatsApp link to start capturing leads."
            action={<Button size="sm">Share link</Button>}
          />
        </div>
      </Section>

      <Section title="ListRow — default / unread / selected / assigned / empty">
        <div className="w-full overflow-hidden rounded-md border border-border">
          <ListRow name="Priya Nair" preview="Is the fee negotiable?" channel="WA" timestamp="2m" assignee="You" />
          <ListRow name="Rahul Das" preview="Sent the brochure" channel="IG" timestamp="1h" unread />
          <ListRow name="Meera Iyer" preview="Call tomorrow 4pm" channel="WA" timestamp="3h" selected assignee="Anil" />
          <ListRow name="Empty preview row" channel="WA" timestamp="—" />
        </div>
      </Section>
    </div>
  )
}

export function KitchenSink() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  )
}
