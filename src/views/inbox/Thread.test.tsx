import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Thread } from './Thread'

describe('Thread empty state', () => {
  it('explains that a conversation has no messages instead of rendering a blank pane', () => {
    render(<Thread messages={[]} traces={[]} />)

    expect(screen.getByText('No messages here yet.')).toBeInTheDocument()
    expect(screen.getByText(/Send the first message below/)).toBeInTheDocument()
  })
})
