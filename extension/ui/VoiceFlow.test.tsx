import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const { transcribeNote, proposeVoiceNote } = vi.hoisted(() => ({
  transcribeNote: vi.fn(),
  proposeVoiceNote: vi.fn(),
}))

vi.mock('../lib/voice-flow', async (original) => ({
  ...await original<typeof import('../lib/voice-flow')>(),
  transcribeNote,
  proposeVoiceNote,
}))

import { VoiceFlow } from './VoiceFlow'

class Recorder {
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(_stream: MediaStream) {}
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  transcribeNote.mockResolvedValue({ kind: 'budget_exceeded' })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
  })
  vi.stubGlobal('MediaRecorder', Recorder)
})

it('a hard voice budget breach offers typing and makes no proposal-model call', async () => {
  const user = userEvent.setup()
  render(<VoiceFlow clientId="client-1" leadId="lead-1" />)

  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  await user.click(screen.getByRole('button', { name: 'Stop recording' }))

  expect(await screen.findByText(/Type note instead/)).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('no lower-quality model')
  expect(proposeVoiceNote).not.toHaveBeenCalled()
})

it('a budget breach on the chat path (propose) also offers typing, not the generic failure', async () => {
  transcribeNote.mockResolvedValue({ kind: 'ok', data: { ok: true, transcript: 'call back tomorrow', provider: 'sarvam', degraded: false } })
  proposeVoiceNote.mockResolvedValue({ kind: 'budget_exceeded' })
  const user = userEvent.setup()
  render(<VoiceFlow clientId="client-1" leadId="lead-1" />)

  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  await user.click(screen.getByRole('button', { name: 'Stop recording' }))

  expect(await screen.findByText(/Type note instead/)).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('no lower-quality model')
  expect(proposeVoiceNote).toHaveBeenCalled()
})
