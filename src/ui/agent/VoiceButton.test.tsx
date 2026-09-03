import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transcribeNote } = vi.hoisted(() => ({ transcribeNote: vi.fn() }))
vi.mock('../../lib/api', () => ({ transcribeNote }))
vi.mock('../../shell/ClientProvider', () => ({
  useClient: () => ({ activeClient: { id: 'a0de0000-0000-4000-8000-000000000001' } }),
}))

const { VoiceButton } = await import('./VoiceButton')

// jsdom has neither getUserMedia nor MediaRecorder. This pair is the smallest
// stand-in that still exercises the real path: press → a recorder is started →
// press again → onstop fires with a blob → the blob is posted.
class FakeRecorder {
  static last: FakeRecorder | null = null
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor() {
    FakeRecorder.last = this
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

beforeEach(() => {
  FakeRecorder.last = null
  ;(globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
  })
})

/** Press to record, press to stop — the two clicks a rep actually makes. */
async function speak(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Push to talk' }))
  await screen.findByRole('button', { name: /Listening/ })
  await user.click(screen.getByRole('button', { name: /Listening/ }))
}

describe('Voice note', () => {
  it('turns a spoken note into editable text without sending anything', async () => {
    const user = userEvent.setup()
    const onTranscript = vi.fn()
    transcribeNote.mockResolvedValue({
      kind: 'ok',
      data: { ok: true, transcript: 'Book a campus visit on Saturday', provider: 'sarvam', degraded: false },
    })
    render(<VoiceButton onTranscript={onTranscript} />)

    await speak(user)

    const box = await screen.findByLabelText('Edit transcript')
    expect(box).toHaveValue('Book a campus visit on Saturday')
    // The transcript is a draft until the rep accepts it — nothing has left
    // this component yet.
    expect(onTranscript).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Use this' }))
    expect(onTranscript).toHaveBeenCalledWith('Book a campus visit on Saturday')
  })

  it('flags a low-confidence transcript instead of presenting it as certain', async () => {
    const user = userEvent.setup()
    transcribeNote.mockResolvedValue({
      kind: 'ok',
      data: { ok: true, transcript: 'call back tomorrow', provider: 'gemini', degraded: true },
    })
    render(<VoiceButton />)

    await speak(user)

    expect(await screen.findByText(/Low confidence/)).toBeInTheDocument()
  })

  it('tells the rep to type when the voice budget is spent, and offers no retry that would bill', async () => {
    const user = userEvent.setup()
    transcribeNote.mockResolvedValue({ kind: 'budget_exceeded' })
    render(<VoiceButton />)

    await speak(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Voice budget reached for this month. Type the note instead.',
    )
    expect(screen.queryByLabelText('Edit transcript')).not.toBeInTheDocument()
    // Back to idle, not stuck spinning.
    expect(screen.getByRole('button', { name: 'Push to talk' })).toBeEnabled()
  })

  it('says permission was refused rather than appearing to record', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new Error('NotAllowedError') } },
    })
    render(<VoiceButton />)

    await user.click(screen.getByRole('button', { name: 'Push to talk' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Microphone permission was not granted/)
    await waitFor(() => expect(transcribeNote).not.toHaveBeenCalled())
  })
})
