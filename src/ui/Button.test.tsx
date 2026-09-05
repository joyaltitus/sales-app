import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders with type="button" by default', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('still renders type="submit" when passed explicitly', () => {
    render(<Button type="submit">Sign in</Button>)
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
  })
})
