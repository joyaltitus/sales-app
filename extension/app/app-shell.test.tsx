import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import App, { getRootMounts } from './App'

it('navigates all four screens without remounting the app root', async () => {
  const user = userEvent.setup()
  render(<App />)

  expect(getRootMounts()).toBe(1)
  expect(screen.getByRole('heading', { name: 'Queue' })).toBeTruthy()

  for (const label of ['Lead', 'Library', 'Settings', 'Queue']) {
    await user.click(screen.getByRole('link', { name: label }))
    if (label === 'Settings') {
      expect(screen.getByText(/keeps the panel visible beside the chat/)).toBeTruthy()
    } else {
      expect(screen.getByRole('heading', { name: label })).toBeTruthy()
    }
  }

  expect(getRootMounts()).toBe(1)
})
