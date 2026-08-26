import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { scriptCard } from '../fixtures'
import { ScriptCard } from './ScriptCard'

describe('ScriptCard', () => {
  it('renders title, version chip and multi-line body', () => {
    render(<ScriptCard {...scriptCard} />)
    expect(screen.getByText(scriptCard.title)).toBeInTheDocument()
    expect(screen.getByText(scriptCard.versionLabel)).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.textContent === scriptCard.body)).toBeInTheDocument()
  })

  it('use button fires the callback', async () => {
    const onUse = vi.fn()
    render(<ScriptCard {...scriptCard} onUse={onUse} />)
    await userEvent.click(screen.getByRole('button', { name: 'Use this script' }))
    expect(onUse).toHaveBeenCalledOnce()
  })

  it('omits the action when no handler is given', () => {
    render(<ScriptCard {...scriptCard} />)
    expect(screen.queryByRole('button', { name: 'Use this script' })).not.toBeInTheDocument()
  })
})
