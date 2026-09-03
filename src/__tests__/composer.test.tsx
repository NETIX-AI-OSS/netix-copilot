// The composer: context chip, auto-grow, Send/Stop flip and the meta row.

import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CopilotProvider, useCopilotEngine } from '../adapters/context'
import type { CopilotAdapters, CopilotPageContext } from '../adapters/types'
import { Composer } from '../components/composer'
import type { CopilotEngine } from '../runtime/engine'
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn } from '../transport/types'
import type { SendTurnInput } from '../types'
import { testAdapters } from './helpers'

class RecordingTransport implements CopilotTransport {
  readonly name = 'sse' as const
  inputs: SendTurnInput[] = []
  cancelled: string[] = []

  async createTurn(input: SendTurnInput): Promise<CreatedTurn> {
    this.inputs.push(input)
    return { turnId: 't1' }
  }

  consumeRun(options: ConsumeRunOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      options.signal.addEventListener('abort', () => resolve(), { once: true })
    })
  }

  async cancelTurn(turnId: string): Promise<void> {
    this.cancelled.push(turnId)
  }

  async respondToApproval(): Promise<void> {
    return Promise.resolve()
  }

  async listThreads() {
    return []
  }
}

let engineRef: CopilotEngine | undefined

function Probe() {
  const engine = useCopilotEngine()
  useEffect(() => {
    engineRef = engine
  }, [engine])
  return null
}

function mount(overrides: Partial<CopilotAdapters> = {}, transport = new RecordingTransport()) {
  render(
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters(overrides)}
      transport={transport}
    >
      <Probe />
      <Composer />
    </CopilotProvider>,
  )
  return transport
}

function pageContext(patch: Partial<CopilotPageContext>): CopilotPageContext {
  const base = testAdapters().pageContext
  const next = { ...base, ...patch }
  if (patch.entity === undefined) delete next.entity
  return next
}

beforeEach(() => {
  engineRef = undefined
})

describe('context chip', () => {
  it('names the record on screen and reports that it is included', () => {
    mount()
    const chip = screen.getByRole('button', { name: 'Page context: AHU-1' })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(chip.getAttribute('data-state')).toBe('on')
    expect(chip.getAttribute('title')).toBe('Included with your next message')
    const label = chip.querySelector('.nxcp-context-chip-label') as HTMLElement
    expect(label.textContent).toBe('@AHU-1')
    expect(label.getAttribute('dir')).toBe('ltr')
  })

  it('toggles the engine flag and reflects it on the chip', () => {
    mount()
    const chip = screen.getByRole('button', { name: 'Page context: AHU-1' })
    act(() => {
      fireEvent.click(chip)
    })
    expect(engineRef?.getSnapshot().contextEnabled).toBe(false)
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    expect(chip.getAttribute('data-state')).toBe('off')
    expect(chip.getAttribute('title')).toBe('Not included — click to include')
    act(() => {
      fireEvent.click(chip)
    })
    expect(engineRef?.getSnapshot().contextEnabled).toBe(true)
  })

  it('tells the prompt transform when the context was switched off', async () => {
    const transformPrompt = vi.fn((prompt: string) => prompt)
    mount({ transformPrompt })
    fireEvent.click(screen.getByRole('button', { name: 'Page context: AHU-1' }))
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hi' } })
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter' })
    })
    expect(transformPrompt).toHaveBeenCalledWith(
      'hi',
      expect.objectContaining({ includeContext: false }),
    )
  })

  it('falls back to the entity type and id when the host gave no label', () => {
    mount({ pageContext: pageContext({ entity: { type: 'asset', id: 17 } }) })
    expect(screen.getByRole('button', { name: 'Page context: asset 17' })).toBeTruthy()
  })

  it('falls back to the host module when there is no entity', () => {
    mount({ pageContext: pageContext({ state: { module: 'alarms' } }) })
    expect(screen.getByRole('button', { name: 'Page context: alarms' })).toBeTruthy()
  })

  it('renders no chip at all when there is nothing to name', () => {
    mount({ pageContext: pageContext({}) })
    expect(document.querySelector('.nxcp-context-chip')).toBeNull()
  })
})

describe('textarea', () => {
  it('starts at one row and grows with the draft', () => {
    mount()
    const box = screen.getByLabelText('Message') as HTMLTextAreaElement
    expect(box.rows).toBe(1)
    fireEvent.change(box, { target: { value: 'one\ntwo\nthree' } })
    // jsdom lays nothing out, so the height is whatever scrollHeight reported, capped at 120.
    expect(box.style.height).toMatch(/^\d+px$/)
    expect(Number.parseInt(box.style.height, 10)).toBeLessThanOrEqual(120)
  })

  it('swaps the placeholder for the offline notice when the browser is offline', () => {
    mount()
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).placeholder).toMatch(
      /^Offline\./,
    )
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
  })
})

describe('Send and Stop', () => {
  it('is one button that reads Stop while a run is live and cancels it', async () => {
    const transport = mount()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'go' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    })
    const stop = screen.getByRole('button', { name: 'Stop' })
    expect(stop.className).toBe('nxcp-send')
    expect(stop.getAttribute('data-busy')).toBe('true')
    expect(stop.hasAttribute('disabled')).toBe(false)
    expect(document.querySelectorAll('.nxcp-send')).toHaveLength(1)

    await act(async () => {
      fireEvent.click(stop)
    })
    expect(transport.cancelled).toEqual(['t1'])
    expect(engineRef?.getSnapshot().turns[0]?.run.status).toBe('cancelled')
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
  })

  it('keeps the tier picker beside the primary button', () => {
    mount()
    const toolbar = document.querySelector('.nxcp-composer-toolbar') as HTMLElement
    expect(toolbar.querySelector('.nxcp-tier-selector')).toBeTruthy()
    expect(toolbar.querySelector('.nxcp-send')).toBeTruthy()
  })
})

describe('meta row', () => {
  it('carries the disclaimer and the keyboard hint', () => {
    mount()
    const meta = document.querySelector('.nxcp-composer-meta') as HTMLElement
    expect(meta.textContent).toContain('Answers can be wrong')
    expect(meta.textContent).toContain('Enter to send · Shift+Enter for a new line')
  })
})

describe('tier labels', () => {
  it('come from the host translate function, not the metadata table', () => {
    mount({ t: (key: string) => `T:${key}` })
    expect(screen.getByRole('option', { name: 'T:copilot.tier.base' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'T:copilot.tier.high' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'T:copilot.tier.max' })).toBeTruthy()
  })
})
