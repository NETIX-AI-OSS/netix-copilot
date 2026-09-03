// The strip under a finished answer: copy, regenerate and the grounding caption.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CopilotProvider, useCopilotEngine, useCopilotState } from '../adapters/context'
import type { CopilotAdapters } from '../adapters/types'
import { AnswerActions, groundingCounts } from '../components/answer-actions'
import type { CopilotEngine, CopilotTurnView } from '../runtime/engine'
import { initialRunState } from '../runtime/run-store'
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn } from '../transport/types'
import type { RunState, SendTurnInput } from '../types'
import { testAdapters } from './helpers'

// Finishes every run at once with a fixed summary, or holds it open when asked to.
class ScriptedTransport implements CopilotTransport {
  readonly name = 'sse' as const
  inputs: SendTurnInput[] = []
  hold = false

  async createTurn(input: SendTurnInput): Promise<CreatedTurn> {
    this.inputs.push(input)
    return { turnId: `t${this.inputs.length}` }
  }

  consumeRun(options: ConsumeRunOptions): Promise<void> {
    if (this.hold) {
      return new Promise<void>((resolve) => {
        options.signal.addEventListener('abort', () => resolve(), { once: true })
      })
    }
    options.onEvent({ event: { type: 'run_started', turnId: options.turnId } })
    options.onEvent({ event: { type: 'message_delta', text: 'Answer text.' } })
    options.onEvent({ event: { type: 'done', tools: ['sql_query'], executionMs: 1500 } })
    return Promise.resolve()
  }

  async cancelTurn(): Promise<void> {
    return Promise.resolve()
  }

  async respondToApproval(): Promise<void> {
    return Promise.resolve()
  }

  async listThreads() {
    return []
  }
}

function turn(run: Partial<RunState>, id = 'turn-1'): CopilotTurnView {
  return {
    id,
    prompt: 'why?',
    createdAt: 1,
    run: { ...initialRunState(), status: 'done', text: 'Answer text.', ...run },
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

// Renders a strip for every turn, finished or not, so the gating itself is observable.
function Strips({ showCaption }: { showCaption?: boolean }) {
  const state = useCopilotState()
  return (
    <>
      <Probe />
      {state.turns.map((entry) => (
        <div key={entry.id} data-testid={entry.id}>
          <AnswerActions turn={entry} {...(showCaption === undefined ? {} : { showCaption })} />
        </div>
      ))}
    </>
  )
}

function mount(
  children: ReactNode,
  overrides: Partial<CopilotAdapters> = {},
  transport = new ScriptedTransport(),
) {
  render(
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters(overrides)}
      transport={transport}
    >
      {children}
    </CopilotProvider>,
  )
  return transport
}

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value })
}

beforeEach(() => {
  engineRef = undefined
})

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else delete (navigator as { clipboard?: unknown }).clipboard
})

describe('copy', () => {
  it('writes the answer to the clipboard and says so', async () => {
    const writeText = vi.fn(async () => undefined)
    setClipboard({ writeText })
    const notify = vi.fn()
    mount(<AnswerActions turn={turn({})} />, { notify })

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({ message: 'Answer copied' }))
    expect(writeText).toHaveBeenCalledWith('Answer text.')
  })

  it('falls back to the selection command where the clipboard API is missing', async () => {
    setClipboard(undefined)
    const execCommand = vi.fn(() => true)
    document.execCommand = execCommand
    const notify = vi.fn()
    mount(<AnswerActions turn={turn({})} />, { notify })

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith({ message: 'Answer copied' }))
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('admits when nothing can copy', async () => {
    setClipboard(undefined)
    document.execCommand = vi.fn(() => false)
    const notify = vi.fn()
    mount(<AnswerActions turn={turn({})} />, { notify })

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith({
        message: 'Copy unavailable in this view',
        tone: 'error',
      }),
    )
  })

  it('has nothing to copy on a failed turn', () => {
    mount(<AnswerActions turn={turn({ status: 'error', text: '' })} />)
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
  })
})

describe('regenerate', () => {
  it('re-sends the prompt as a new turn on the same thread', async () => {
    const transport = mount(<Strips />)
    await act(async () => {
      await engineRef?.send('why?')
    })
    expect(screen.getByRole('button', { name: 'Regenerate' }).hasAttribute('disabled')).toBe(false)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    })
    expect(transport.inputs.map((input) => input.prompt)).toEqual(['why?', 'why?'])
    expect(transport.inputs[1]?.threadId).toBe(transport.inputs[0]?.threadId ?? 't1')
    expect(engineRef?.getSnapshot().turns).toHaveLength(2)
  })

  it('reuses the wire text the host wrote the first time', async () => {
    const transport = mount(<Strips />)
    await act(async () => {
      await engineRef?.send('why?', undefined, { wireText: 'why? ASSET_ID: 17' })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    })
    expect(transport.inputs[1]?.prompt).toBe('why? ASSET_ID: 17')
    expect(engineRef?.getSnapshot().turns[1]?.prompt).toBe('why?')
  })

  it('belongs to the newest turn only', async () => {
    mount(<Strips />)
    await act(async () => {
      await engineRef?.send('first')
    })
    await act(async () => {
      await engineRef?.send('second')
    })
    const turns = engineRef?.getSnapshot().turns ?? []
    expect(turns).toHaveLength(2)
    const first = screen.getByTestId(turns[0]!.id)
    const second = screen.getByTestId(turns[1]!.id)
    expect(first.querySelector('[aria-label="Regenerate"]')).toBeNull()
    expect(second.querySelector('[aria-label="Regenerate"]')).toBeTruthy()
  })

  it('waits while a run is live', async () => {
    const transport = new ScriptedTransport()
    transport.hold = true
    mount(<Strips />, {}, transport)
    await act(async () => {
      await engineRef?.send('why?')
    })
    expect(engineRef?.getSnapshot().turns[0]?.run.status).toBe('creating')
    expect(screen.getByRole('button', { name: 'Regenerate' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('caption', () => {
  it('names the tools, the specialists and the seconds', () => {
    mount(
      <AnswerActions
        turn={turn({
          executionMs: 12_400,
          tools: ['call_facilities_agent', 'realtime_data_retrieve', 'execute_code'],
          steps: [
            { id: 'a', title: 'f', tool: 'call_facilities_agent', status: 'ok' },
            { id: 'b', title: 'r', tool: 'realtime_data_retrieve', status: 'ok' },
          ],
        })}
      />,
    )
    expect(screen.getByText('Used 3 tools · 1 specialists · 12.4 s')).toBeTruthy()
  })

  it('drops the specialist count when none ran', () => {
    mount(<AnswerActions turn={turn({ executionMs: 800, tools: ['sql_query'] })} />)
    expect(screen.getByText('Used 1 tools · 0.8 s')).toBeTruthy()
  })

  it('is right-aligned caption text, not a control', () => {
    mount(<AnswerActions turn={turn({ executionMs: 800, tools: ['sql_query'] })} />)
    expect(screen.getByText('Used 1 tools · 0.8 s').className).toBe('nxcp-actions-caption')
  })

  it('can be switched off by the host', () => {
    mount(
      <AnswerActions turn={turn({ executionMs: 800, tools: ['sql_query'] })} showCaption={false} />,
    )
    expect(screen.queryByText(/Used /)).toBeNull()
  })

  it('needs a duration to say anything', () => {
    mount(<AnswerActions turn={turn({ tools: ['sql_query'] })} />)
    expect(screen.queryByText(/Used /)).toBeNull()
  })
})

describe('groundingCounts', () => {
  it('prefers the tools the backend reported over the steps seen', () => {
    expect(
      groundingCounts({
        ...initialRunState(),
        tools: ['a', 'b', 'c'],
        steps: [{ id: 's', title: 's', tool: 'a', status: 'ok' }],
      }),
    ).toEqual({ tools: 3, agents: 0 })
  })

  it('counts non-agent steps when the summary is empty', () => {
    expect(
      groundingCounts({
        ...initialRunState(),
        steps: [
          { id: '1', title: 'x', tool: 'call_asset_agent', status: 'ok' },
          { id: '2', title: 'y', tool: 'asset_get', status: 'ok' },
          { id: '3', title: 'z', kind: 'agent', status: 'ok' },
        ],
      }),
    ).toEqual({ tools: 1, agents: 2 })
  })
})
