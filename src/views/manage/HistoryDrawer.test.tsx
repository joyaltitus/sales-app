import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Revision } from '../../lib/manage-data'

// A campaign revert commits the campaigns row, THEN runs the code-word and
// spend RPCs. When a later leg refuses, the row has already changed — including
// `active`, which is revertable. This drawer used to say "nothing changed".
const { revertTo } = vi.hoisted(() => ({ revertTo: vi.fn() }))
vi.mock('../../lib/manage-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/manage-data')>()),
  revertTo,
  useRevisions: () => ({ items: [revision()], loading: false, error: null, reload: vi.fn() }),
}))

const { HistoryDrawer } = await import('./HistoryDrawer')

function revision(): Revision {
  return {
    id: 'rev-1',
    table_name: 'campaigns',
    record_pk: 'ca-1',
    record_key: 'diwali_2026',
    op: 'update',
    before: { name: 'Diwali 2026', active: true },
    after: { name: 'Diwali 2026 v2', active: false },
    actor: 'u-1',
    source: 'ui',
    created_at: '2026-09-01T10:00:00Z',
  }
}

function renderDrawer() {
  return render(
    <HistoryDrawer
      open
      onClose={vi.fn()}
      clientId="c-1"
      userId="u-1"
      tableName="campaigns"
      recordPk="ca-1"
      title="Diwali 2026"
      names={new Map()}
      onReverted={vi.fn()}
    />,
  )
}

async function clickRestore() {
  await userEvent.setup().click(screen.getByRole('button', { name: /restore this version/i }))
}

describe('HistoryDrawer revert failures', () => {
  beforeEach(() => revertTo.mockReset())

  it('does not claim nothing changed when the row was already restored', async () => {
    revertTo.mockResolvedValue({ ok: false, code: 'partial:collision', detail: 'code words' })
    renderDrawer()
    await clickRestore()

    const alert = await screen.findByRole('alert')
    expect(alert).not.toHaveTextContent(/nothing changed/i)
    expect(alert).toHaveTextContent(/the row was restored/i)
    expect(alert).toHaveTextContent(/code words/i)
    expect(alert).toHaveTextContent(/half-restored/i)
    // The bare code stays visible; only the "partial:" marker is stripped.
    expect(alert).toHaveTextContent('collision')
    expect(alert).not.toHaveTextContent('partial:collision')
  })

  it('names the leg that failed, so spend is not reported as code words', async () => {
    revertTo.mockResolvedValue({ ok: false, code: 'partial:write_failed', detail: 'spend' })
    renderDrawer()
    await clickRestore()

    expect(await screen.findByRole('alert')).toHaveTextContent(/but its spend could not be/i)
  })

  it('still says nothing changed for a refusal that really changed nothing', async () => {
    revertTo.mockResolvedValue({ ok: false, code: 'denied' })
    renderDrawer()
    await clickRestore()

    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing changed/i)
  })
})
