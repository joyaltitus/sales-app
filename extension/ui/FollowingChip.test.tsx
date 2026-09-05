import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FollowingChip } from './FollowingChip'

const toggle = vi.fn()

describe('FollowingChip', () => {
  it('names the followed contact when following', () => {
    render(<FollowingChip enabled chatName="Anjali Rao" onToggle={toggle} />)
    expect(screen.getByRole('switch')).toHaveTextContent('Following Anjali Rao')
  })

  it('reads as idle when paused', () => {
    render(<FollowingChip enabled={false} chatName={null} onToggle={toggle} />)
    expect(screen.getByRole('switch')).toHaveTextContent('Not following chats')
  })

  it('tells no-chat apart from a group chat', () => {
    const { unmount } = render(<FollowingChip enabled chatName={null} onToggle={toggle} />)
    const idle = screen.getByRole('switch').textContent
    expect(idle).toMatch(/no chat open/i)
    unmount()

    render(<FollowingChip enabled chatName={null} isGroup onToggle={toggle} />)
    const group = screen.getByRole('switch').textContent
    expect(group).toMatch(/group not followed/i)
    expect(group).not.toBe(idle)
  })
})
