import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { snippets } from '../fixtures'
import { applyVars, SnippetPicker } from './SnippetPicker'

describe('SnippetPicker', () => {
  it('lists snippets with scope chips and a substituted preview', () => {
    render(<SnippetPicker snippets={snippets} vars={{ name: 'Anjali' }} onInsert={vi.fn()} />)
    const list = screen.getByLabelText('Snippets')
    expect(within(list).getByText('Greeting')).toBeInTheDocument()
    expect(within(list).getByText('Hi Anjali! Thanks for reaching out about the 3BHK.')).toBeInTheDocument()
    expect(screen.getAllByText('personal')).toHaveLength(2)
    expect(screen.getByText('shared')).toBeInTheDocument()
  })

  it('leaves unknown variables untouched in the preview', () => {
    expect(applyVars('Hello {{name}}, re {{mystery}}', { name: 'Ravi' })).toBe('Hello Ravi, re {{mystery}}')
  })

  it('filters by title and body', async () => {
    render(<SnippetPicker snippets={snippets} onInsert={vi.fn()} />)
    const search = screen.getByLabelText('Search snippets')
    await userEvent.type(search, 'visit')
    expect(screen.getByText('Site visit ask')).toBeInTheDocument()
    expect(screen.queryByText('Greeting')).not.toBeInTheDocument()
  })

  it('insert callback returns the full snippet object', async () => {
    const onInsert = vi.fn()
    render(<SnippetPicker snippets={snippets} onInsert={onInsert} />)
    await userEvent.click(screen.getByRole('button', { name: /Payment plan/ }))
    expect(onInsert).toHaveBeenCalledWith(snippets[2])
  })

  it('empty result shows an empty state, never a blank panel', async () => {
    render(<SnippetPicker snippets={snippets} onInsert={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Search snippets'), 'zzz')
    expect(screen.getByText('No snippet matches')).toBeInTheDocument()
  })
})
