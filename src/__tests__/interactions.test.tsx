import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CopilotProvider, useCopilotEngine } from '../adapters/context'
import { CopilotDock } from '../components/dock'
import type { CopilotEngine } from '../runtime/engine'
import { AgenticTransport } from '../transport/agentic-transport'
import { AutoTransport } from '../transport/auto-transport'
import { SseTransport } from '../transport/sse-transport'
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn } from '../transport/types'
import { sleep } from '../transport/types'
import type { EnvelopedEvent } from '../types'
import { errorResponse, instantSleep, jsonResponse, testAdapters } from './helpers'

class DecisionTransport implements CopilotTransport {
  readonly name = 'sse' as const
  decisions: Array<[string, string, boolean]> = []
  approvalError: Error | undefined
  consumeCalls: ConsumeRunOptions[] = []

  async createTurn(): Promise<CreatedTurn> {
    return { turnId: 't1' }
  }

  consumeRun(options: ConsumeRunOptions): Promise<void> {
    this.consumeCalls.push(options)
    return new Promise<void>((resolve) => {
      options.signal.addEventListener('abort', () => resolve(), { once: true })
    })
  }

  async cancelTurn(): Promise<void> {
    return Promise.resolve()
  }

  async respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void> {
    if (this.approvalError) throw this.approvalError
    this.decisions.push([turnId, stepId, approved])
  }

  async listThreads() {
    return []
  }

  emit(enveloped: EnvelopedEvent): void {
    act(() => {
      this.consumeCalls[this.consumeCalls.length - 1]?.onEvent(enveloped)
    })
  }
}

// jsdom does not implement PointerEvent, so testing-library's pointer helpers drop clientX.
// A MouseEvent named pointermove still reaches React's synthetic handler with the coordinate.
function pointerMoveAt(clientX: number): Event {
  return new MouseEvent('pointermove', { bubbles: true, clientX })
}

function stubPointerCapture(element: HTMLElement): HTMLElement {
  Object.assign(element, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
  })
  return element
}

let engineRef: CopilotEngine | undefined

function Probe() {
  const engine = useCopilotEngine()
  // Captured in an effect, never during render, so the probe stays a pure component.
  useEffect(() => {
    engineRef = engine
  }, [engine])
  return null
}

function mountDock(transport: CopilotTransport) {
  return render(
    <CopilotProvider
      config={{ baseUrl: 'https://ml.example.com' }}
      adapters={testAdapters()}
      transport={transport}
    >
      <Probe />
      <CopilotDock defaultOpen showThreads={false} />
    </CopilotProvider>,
  )
}

async function startRunWithApproval(transport: DecisionTransport) {
  await act(async () => {
    await engineRef?.send('close work order 55')
  })
  transport.emit({ event: { type: 'run_started', turnId: 't1' } })
  transport.emit({
    event: {
      type: 'step_started',
      step: {
        id: 's1',
        title: 'Close work order 55',
        status: 'awaiting_approval',
        argsSummary: 'id=55',
      },
    },
  })
}

describe('compact model tier picker', () => {
  beforeEach(() => {
    engineRef = undefined
    window.localStorage.clear()
  })

  it('offers friendly tier labels through one keyboard-native control', () => {
    mountDock(new DecisionTransport())
    const picker = screen.getByRole('combobox', {
      name: 'Response quality',
    }) as HTMLSelectElement
    expect(picker.value).toBe('base')
    expect(screen.getByRole('option', { name: 'Base 1x' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'High 5x' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Max 20x' })).toBeTruthy()
    fireEvent.change(picker, { target: { value: 'high' } })
    expect(picker.value).toBe('high')
  })

  it('locks the compact picker after the first successful create', async () => {
    mountDock(new DecisionTransport())
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'hello' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => {
      const picker = screen.getByRole('combobox', {
        name: 'Response quality',
      }) as HTMLSelectElement
      expect(picker.disabled).toBe(true)
    })
  })
})

// The reason this matters is the mount pattern: both host apps mount the dock on every
// authenticated route, not on a few leaf pages. ml-engine's main carries no copilot routes, so on
// a cluster that has not shipped them the thread routes are 404s on every page load.
describe('the always-on dock against a cluster with no copilot routes', () => {
  beforeEach(() => {
    engineRef = undefined
    window.localStorage.clear()
  })

  function mountWithThreads(logger: { warn: () => void; error: () => void }) {
    const transport = new AutoTransport(
      new SseTransport({
        baseUrl: 'https://ml.example.com',
        fetchImpl: (async () => errorResponse(404)) as never,
      }),
      new AgenticTransport({ baseUrl: 'https://ml.example.com' }),
    )
    return render(
      <CopilotProvider
        config={{ baseUrl: 'https://ml.example.com', logger }}
        adapters={testAdapters()}
        transport={transport}
      >
        <Probe />
        <CopilotDock defaultOpen />
      </CopilotProvider>,
    )
  }

  it('shows an empty conversation list rather than surfacing the 404', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() }
    mountWithThreads(logger)
    // The list is fetched when the popover opens, not on every page load.
    expect(engineRef?.getSnapshot().threadsLoaded).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Conversations' }))
    expect(await screen.findByText('No earlier conversations.')).toBeTruthy()
    expect(engineRef?.getSnapshot().threadsLoaded).toBe(true)
    expect(engineRef?.getSnapshot().threads).toEqual([])
    // Empty is the answer, so nothing is reported: this would otherwise fire on every page load.
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('restores a deep-linked thread to an empty panel rather than throwing', async () => {
    const logger = { warn: vi.fn(), error: vi.fn() }
    mountWithThreads(logger)
    await act(async () => {
      await engineRef?.loadThread('12')
    })
    expect(engineRef?.getSnapshot().turns).toEqual([])
    expect(engineRef?.getSnapshot().threadLoading).toBe(false)
    expect(logger.warn).not.toHaveBeenCalled()
  })
})

describe('ApprovalCard decisions', () => {
  beforeEach(() => {
    engineRef = undefined
    window.localStorage.clear()
  })

  it('sends an approval through the transport', async () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    await startRunWithApproval(transport)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    })
    expect(transport.decisions).toEqual([['t1', 's1', true]])
  })

  it('sends a rejection through the transport', async () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    await startRunWithApproval(transport)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    })
    expect(transport.decisions).toEqual([['t1', 's1', false]])
  })

  it('shows the failure when the decision cannot be recorded', async () => {
    const transport = new DecisionTransport()
    transport.approvalError = new Error('approvals need the streaming contract')
    mountDock(transport)
    await startRunWithApproval(transport)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    })
    expect(screen.getByText('approvals need the streaming contract')).toBeTruthy()
  })

  it('renders the argument summary so the decision is informed', async () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    await startRunWithApproval(transport)
    // The summary shows twice: once in the step timeline, once on the approval card.
    expect(screen.getAllByText('id=55').length).toBeGreaterThan(0)
  })
})

describe('Dock controls', () => {
  beforeEach(() => {
    engineRef = undefined
    window.localStorage.clear()
  })

  it('closes back to the launcher and remembers that it is closed', () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    fireEvent.click(screen.getByRole('button', { name: 'Close copilot' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(window.localStorage.getItem('netix-copilot.open')).toBe('false')
  })

  it('reopens from the launcher', () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    fireEvent.click(screen.getByRole('button', { name: 'Close copilot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copilot assistant' }))
    expect(screen.getByRole('complementary')).toBeTruthy()
  })

  it('clears the conversation from the header', async () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    await act(async () => {
      await engineRef?.send('first question')
    })
    expect(screen.getByText('first question')).toBeTruthy()
    transport.emit({ event: { type: 'done' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New' }))
    })
    expect(screen.queryByText('first question')).toBeNull()
    expect(screen.getByText('Ask about anything on this page.')).toBeTruthy()
  })

  it('resizes with the keyboard and persists the result', () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    const handle = screen.getByRole('button', { name: 'Resize copilot dock' })
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('454px')
    expect(window.localStorage.getItem('netix-copilot.width')).toBe('454')
  })

  it('shrinks with the opposite arrow and clamps at the minimum', () => {
    window.localStorage.setItem('netix-copilot.width', '330')
    const transport = new DecisionTransport()
    mountDock(transport)
    const handle = screen.getByRole('button', { name: 'Resize copilot dock' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('320px')
  })

  it('resizes by dragging the handle', () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    const handle = stubPointerCapture(screen.getByRole('button', { name: 'Resize copilot dock' }))
    fireEvent.pointerDown(handle, { pointerId: 1 })
    // jsdom ships no PointerEvent, so a MouseEvent carries clientX for the pointermove. The
    // card floats 22px in from the edge, so the pointer sits that much further out.
    fireEvent(handle, pointerMoveAt(window.innerWidth - 500 - 22))
    fireEvent.pointerUp(handle, { pointerId: 1 })
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('500px')
  })

  it('clamps a drag past the maximum width', () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    const handle = stubPointerCapture(screen.getByRole('button', { name: 'Resize copilot dock' }))
    fireEvent.pointerDown(handle, { pointerId: 1 })
    fireEvent(handle, pointerMoveAt(0))
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('720px')
  })

  it('keeps the current width when the pointer reports no coordinate', () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    const handle = stubPointerCapture(screen.getByRole('button', { name: 'Resize copilot dock' }))
    fireEvent.pointerDown(handle, { pointerId: 1 })
    fireEvent.pointerMove(handle, { pointerId: 1 })
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('430px')
  })

  it('ignores pointer movement that did not start on the handle', () => {
    const transport = new DecisionTransport()
    mountDock(transport)
    const handle = screen.getByRole('button', { name: 'Resize copilot dock' })
    fireEvent(handle, pointerMoveAt(10))
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('430px')
  })

  it('survives localStorage being unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const transport = new DecisionTransport()
    expect(() => mountDock(transport)).not.toThrow()
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('AutoTransport.consumeRun', () => {
  it('degrades to polling when the stream route is absent', async () => {
    const streaming = new SseTransport({
      baseUrl: 'https://ml.example.com',
      fetchImpl: (async () => errorResponse(404)) as never,
      sleepImpl: instantSleep,
    })
    // The SSE transport swallows its own 404 by cursor-polling, so drive AutoTransport with a
    // streaming stub that reports the missing route straight through instead.
    const failing: CopilotTransport = {
      ...streaming,
      name: 'sse',
      createTurn: streaming.createTurn.bind(streaming),
      consumeRun: async () => {
        const { CopilotHttpError } = await import('../transport/http')
        throw new CopilotHttpError(404, '')
      },
      cancelTurn: async () => undefined,
      respondToApproval: async () => undefined,
      listThreads: async () => [],
    }
    const polling = new AgenticTransport({
      baseUrl: 'https://ml.example.com',
      fetchImpl: (async () => jsonResponse({ status: 1, response_text: 'answered' })) as never,
      sleepImpl: instantSleep,
    })
    const auto = new AutoTransport(failing, polling)

    const seen: string[] = []
    await auto.consumeRun({
      turnId: '1',
      signal: new AbortController().signal,
      onEvent: (entry) => seen.push(entry.event.type),
    })
    expect(auto.selected).toBe('agentic')
    expect(seen).toContain('done')
  })

  it('reports the streaming name before anything is resolved', () => {
    const auto = new AutoTransport(
      new SseTransport({ baseUrl: 'https://x' }),
      new AgenticTransport({ baseUrl: 'https://x' }),
    )
    expect(auto.name).toBe('sse')
    expect(auto.selected).toBeUndefined()
  })

  it('rebuilds history through whichever transport is live', async () => {
    const polling = new AgenticTransport({
      baseUrl: 'https://x',
      fetchImpl: (async () => jsonResponse({ id: 4, prompt_text: 'earlier', status: 1 })) as never,
    })
    const auto = new AutoTransport(
      new SseTransport({
        baseUrl: 'https://x',
        fetchImpl: (async () => errorResponse(404)) as never,
      }),
      polling,
    )
    await auto
      .createTurn({ prompt: 'x', scope: { organization_id: 1, user_id: 2 } })
      .catch(() => undefined)
    const turns = await auto.fetchThread('4')
    expect(turns[0]?.prompt).toBe('earlier')
  })

  // A conversation id is what a briefing deep link carries, and only the streaming contract can
  // read one, so an unresolved auto transport must not send it to the agentic detail route.
  it('reads threads through streaming before a transport has been chosen', async () => {
    const sseFetch = vi.fn(
      async () =>
        jsonResponse({ results: [{ id: 4, prompt_text: 'earlier', status: 1 }] }) as never,
    )
    const agenticFetch = vi.fn(async () => jsonResponse({ results: [] }) as never)
    const auto = new AutoTransport(
      new SseTransport({ baseUrl: 'https://x', fetchImpl: sseFetch as never }),
      new AgenticTransport({ baseUrl: 'https://x', fetchImpl: agenticFetch as never }),
    )
    await auto.listThreads()
    await auto.fetchThread('4')
    expect(agenticFetch).not.toHaveBeenCalled()
    expect((sseFetch.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://x/api/copilot-conversation/',
    )
    expect((sseFetch.mock.calls[1] as unknown as [string])[0]).toBe(
      'https://x/api/copilot-turn/?conversation=4',
    )
  })

  it('reports an empty history for a transport that cannot rebuild one', async () => {
    const bare: CopilotTransport = {
      name: 'agentic',
      createTurn: async () => ({ turnId: '1' }),
      consumeRun: async () => undefined,
      cancelTurn: async () => undefined,
      respondToApproval: async () => undefined,
      listThreads: async () => [],
    }
    const auto = new AutoTransport(bare, bare)
    expect(await auto.fetchThread('4')).toEqual([])
  })

  it('routes cancel and thread listing somewhere harmless until a choice is made', async () => {
    const polling = new AgenticTransport({
      baseUrl: 'https://x',
      fetchImpl: (async () => jsonResponse({ results: [] })) as never,
    })
    const auto = new AutoTransport(
      new SseTransport({
        baseUrl: 'https://x',
        fetchImpl: (async () => jsonResponse({ results: [] })) as never,
      }),
      polling,
    )
    await expect(auto.cancelTurn('1')).resolves.toBeUndefined()
    await expect(auto.listThreads()).resolves.toEqual([])
  })
})

describe('sleep', () => {
  it('resolves after the delay', async () => {
    const started = Date.now()
    await sleep(5)
    expect(Date.now() - started).toBeGreaterThanOrEqual(1)
  })

  it('resolves immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(sleep(10_000, controller.signal)).resolves.toBeUndefined()
  })

  it('resolves early when the signal aborts mid-wait', async () => {
    const controller = new AbortController()
    const pending = sleep(10_000, controller.signal)
    controller.abort()
    await expect(pending).resolves.toBeUndefined()
  })
})
