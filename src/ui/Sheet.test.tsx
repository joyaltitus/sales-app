import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('locks body scroll while open and restores the previous value on close', () => {
    document.body.style.overflow = 'auto'
    const { rerender, unmount } = render(
      <Sheet open onClose={() => {}}>
        content
      </Sheet>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Sheet open={false} onClose={() => {}}>
        content
      </Sheet>,
    )
    expect(document.body.style.overflow).toBe('auto')

    // Re-open then unmount: cleanup must still restore, not blank.
    document.body.style.overflow = 'auto'
    const second = render(
      <Sheet open onClose={() => {}}>
        content
      </Sheet>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    second.unmount()
    expect(document.body.style.overflow).toBe('auto')

    unmount()
    document.body.style.overflow = ''
  })
})
