import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { FeatureGrant } from '../lib/featureOn'

// hub #276: the rep's `product_ai` door used to read a jsonb column on
// `clients`; it now reads `feature_grants`, the entitlement table C3 already
// uses everywhere else. hub-service drops that column once this is deployed, so
// what these tests pin is that the door's ANSWER did not change with its source:
// no grant means hidden, and a grant the tenant has switched off means hidden.
const { grants } = vi.hoisted(() => ({ grants: vi.fn() }))
vi.mock('../lib/featureOn', async () => {
  const actual = await vi.importActual<typeof import('../lib/featureOn')>('../lib/featureOn')
  return { ...actual, useFeatureGrants: grants }
})
vi.mock('../lib/inbox-data', () => ({ useQueue: () => ({ items: [] }) }))
vi.mock('./TopBar', () => ({ TopBar: () => <div /> }))
vi.mock('../views/rep/screens', () => ({
  Today: () => <div>Today</div>,
  RepInbox: () => <div>Inbox</div>,
  More: ({ productAi }: { productAi: boolean }) => <div>More productAi={String(productAi)}</div>,
  ProductAiDoor: () => <div>ProductAiDoor</div>,
}))

const { mockUseClient } = vi.hoisted(() => ({ mockUseClient: vi.fn() }))
vi.mock('./ClientProvider', () => ({ useClient: mockUseClient }))

const { RepShell } = await import('./RepShell')

function grant(over: Partial<FeatureGrant> = {}): FeatureGrant {
  return {
    id: 'g-1',
    feature: 'product_ai',
    granted: true,
    enabled: true,
    enabled_roles: ['client_admin', 'manager', 'agent'],
    ...over,
  }
}

function renderRep(rows: FeatureGrant[]) {
  grants.mockReturnValue({ grants: rows, loading: false, error: null, reload: vi.fn() })
  mockUseClient.mockReturnValue({
    activeClient: { id: 'c-1', name: 'Demo', vertical: 'education', role: 'agent' },
  })
  return render(
    // RepShell owns a bare <Routes>, so its child paths are matched against the
    // whole location here — no /rep prefix, unlike the app, where it is nested.
    <MemoryRouter initialEntries={['/more']}>
      <RepShell />
    </MemoryRouter>,
  )
}

describe('the rep product_ai door, now read from feature_grants', () => {
  it('opens when the tenant holds the grant and it is on for reps', () => {
    renderRep([grant()])
    expect(screen.getByText('More productAi=true')).toBeInTheDocument()
  })

  it('stays hidden when there is no grant row at all — the old "no flag, no door" default', () => {
    renderRep([])
    expect(screen.getByText('More productAi=false')).toBeInTheDocument()
  })

  it('stays hidden when the plan does not include it', () => {
    renderRep([grant({ granted: false })])
    expect(screen.getByText('More productAi=false')).toBeInTheDocument()
  })

  it('stays hidden when the tenant switched it off', () => {
    renderRep([grant({ enabled: false })])
    expect(screen.getByText('More productAi=false')).toBeInTheDocument()
  })

  it('stays hidden when the feature is on but not for this role', () => {
    renderRep([grant({ enabled_roles: ['client_admin'] })])
    expect(screen.getByText('More productAi=false')).toBeInTheDocument()
  })
})
