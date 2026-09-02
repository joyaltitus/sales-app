import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScriptSheet } from './ScriptSheet'
import { rebuttals, roadmapScripts, spins } from '../fixtures'
import type { PersonalSpin } from '../lib/contracts'

vi.mock('../lib/panel-client', () => ({
  panelSupabase: {},
  HUB_URL: 'https://hub.test',
  hubPlaybookUrl: (id: string) => `https://hub.test/docs?workspace=playbook&taxonomy=${id}`,
}))

const pitch = roadmapScripts.find((script) => script.taxonomy_key === 'stage_pitch')!
const price = rebuttals.find((script) => script.taxonomy_key === 'price')!
const spinMap = (list: PersonalSpin[]) => new Map(list.map((spin) => [spin.lang, spin]))

function sheet(over: Partial<Parameters<typeof ScriptSheet>[0]> = {}) {
  return (
    <ScriptSheet
      script={pitch}
      onClose={() => {}}
      langs={['en', 'mn']}
      lang="en"
      onLang={() => {}}
      vars={{ 'course.fee': '₹85,000' }}
      spins={spinMap(spins)}
      canEditStandard={false}
      onSaveSpin={() => {}}
      onResetSpin={() => {}}
      onInsert={() => {}}
      {...over}
    />
  )
}

describe('ScriptSheet', () => {
  it('shows the version, the counted win rate, and the standard with tokens filled', () => {
    render(sheet())
    expect(screen.getByText('v3')).toBeInTheDocument()
    expect(screen.getByText('61%')).toBeInTheDocument()
    expect(screen.getByText('18 rated · 22 uses')).toBeInTheDocument()
    expect(screen.getByText(/₹85,000/)).toBeInTheDocument()
  })

  it('a rep is told where the standard is edited, and given no editor for it', () => {
    render(sheet())
    expect(screen.getByText(/Company standard is edited by your manager in Sales Hub/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Edit company standard/ })).not.toBeInTheDocument()
  })

  it('a manager gets the Sales Hub link, pointed at this taxonomy', () => {
    render(sheet({ canEditStandard: true }))
    expect(screen.getByRole('link', { name: /Edit company standard in Sales Hub/ }))
      .toHaveAttribute('href', `https://hub.test/docs?workspace=playbook&taxonomy=${pitch.taxonomy_id}`)
  })

  it('saves the rep spin for the dialect on screen, and only when it changed', async () => {
    const user = userEvent.setup()
    const onSaveSpin = vi.fn()
    render(sheet({ onSaveSpin }))

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('My spin in en'), ' Really.')
    await user.click(save)
    expect(onSaveSpin).toHaveBeenCalledWith('en', expect.stringContaining('I did this course myself. Really.'))
  })

  it('refuses to save past the character cap', async () => {
    const user = userEvent.setup()
    render(sheet({ spins: new Map() }))
    const box = screen.getByLabelText('My spin in en')
    await user.click(box)
    await user.paste('x'.repeat(1501))
    expect(screen.getByText('1501/1500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('offers Reset only when a spin exists', () => {
    const { rerender } = render(sheet())
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    rerender(sheet({ spins: new Map() }))
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })

  it('warns when the standard moved on after the spin was written', () => {
    render(sheet({
      script: { ...pitch, created_at: '2026-09-01T00:00:00.000Z' },
    }))
    expect(screen.getByText('Standard changed since your spin')).toBeInTheDocument()
  })

  it('says nothing about a stale spin when the standard is older', () => {
    render(sheet({ script: { ...pitch, created_at: '2026-08-01T00:00:00.000Z' } }))
    expect(screen.queryByText('Standard changed since your spin')).not.toBeInTheDocument()
  })

  it('flags a dialect the standard has no version for', () => {
    render(sheet({ script: price, lang: 'hi', langs: ['en', 'mn', 'hi'], spins: new Map() }))
    expect(screen.getByText('EN — no HI yet')).toBeInTheDocument()
    expect(screen.getByText(/Compare the loaded rate/)).toBeInTheDocument()
  })

  it('inserts the standard as flat text, never the highlight markup', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    render(sheet({ onInsert }))
    await user.click(screen.getByRole('button', { name: 'Insert standard' }))
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('EMI is {{course.emi}} a month.'))
  })
})
