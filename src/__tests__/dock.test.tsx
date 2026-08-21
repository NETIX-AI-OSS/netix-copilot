import { act, render, screen } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CopilotProvider, useCopilotEngine } from '../adapters/context'
import type { CopilotAdapters } from '../adapters/types'
import { CopilotDock } from '../components/dock'
import type { CopilotEngine } from '../runtime/engine'
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn } from '../transport/types'
import type { EnvelopedEvent } from '../types'
import { testAdapters } from './helpers'

class ScriptedTransport implements CopilotTransport {
  readonly name = 'sse' as const
  consumeCalls: ConsumeRunOptions[] = []
  createCalls = 0
  threads = [{ id: 'th1', title: 'Earlier question', updatedAt: 1 }]

  async createTurn(): Promise<CreatedTurn> {
    this.createCalls += 1
    return { turnId: 't1', threadId: 'th1' }
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

  async respondToApproval(): Promise<void> {
    return Promise.resolve()
  }

  async listThreads() {
    return this.threads
  }

  emit(enveloped: EnvelopedEvent): void {
    act(() => {
      this.consumeCalls[this.consumeCalls.length - 1]?.onEvent(enveloped)
    })
  }
}

let capturedEngine: CopilotEngine | undefined

function EngineProbe() {
  const engine = useCopilotEngine()
  // Captured in an effect, never during render, so the probe stays a pure component.
  useEffect(() => {
    capturedEngine = engine
  }, [engine])
  return null
}

function mount(
  transport: ScriptedTransport,
  adapterOverrides: Partial<CopilotAdapters> = {},
  strict = false,
) {
  const tree = (
    <CopilotProvider
      config={{ baseUrl: 'https://ml.example.com' }}
      adapters={testAdapters(adapterOverrides)}
      transport={transport}
    >
      <EngineProbe />
      <CopilotDock defaultOpen showThreads={false} />
    </CopilotProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

async function send(prompt: string) {
  await act(async () => {
    await capturedEngine?.send(prompt)
  })
}

describe('CopilotDock', () => {
  beforeEach(() => {
    capturedEngine = undefined
    window.localStorage.clear()
  })

  it('holds no connection while idle, even under StrictMode', () => {
    const transport = new ScriptedTransport()
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
    mount(transport, {}, true)

    expect(screen.getByRole('complementary', { name: 'Copilot assistant' })).toBeTruthy()
    expect(transport.createCalls).toBe(0)
    expect(transport.consumeCalls).toHaveLength(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('starts exactly one run under StrictMode, not two', async () => {
    const transport = new ScriptedTransport()
    mount(transport, {}, true)
    await send('why is AHU-1 offline?')
    expect(transport.createCalls).toBe(1)
    expect(transport.consumeCalls).toHaveLength(1)
  })

  it('renders nothing when the user lacks the permission', () => {
    const transport = new ScriptedTransport()
    mount(transport, { hasPermission: () => false })
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('portals into document.body so a host stacking context cannot trap it', () => {
    const transport = new ScriptedTransport()
    const { container } = mount(transport)
    expect(container.querySelector('.nxcp-dock')).toBeNull()
    expect(document.body.querySelector('.nxcp-dock')).toBeTruthy()
  })

  it('injects its stylesheet once', () => {
    const transport = new ScriptedTransport()
    mount(transport, {}, true)
    expect(document.querySelectorAll('#netix-copilot-styles')).toHaveLength(1)
  })

  it('shows the launcher instead of the dock when closed', () => {
    const transport = new ScriptedTransport()
    render(
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters()}
        transport={transport}
      >
        <CopilotDock />
      </CopilotProvider>,
    )
    expect(screen.getByRole('button', { name: 'Ask Copilot' })).toBeTruthy()
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('renders the prompt and the streaming answer', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('why is AHU-1 offline?')
    transport.emit({ event: { type: 'run_started', turnId: 't1' } })
    transport.emit({ event: { type: 'message_delta', text: 'It lost **power**.' } })

    expect(screen.getByText('why is AHU-1 offline?')).toBeTruthy()
    expect(screen.getByText('power')).toBeTruthy()
  })

  it('renders a step timeline and completes without ever receiving a plan', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('hello')
    transport.emit({
      event: {
        type: 'step_result',
        step: { id: 'c1', title: 'asset_get', status: 'ok', tool: 'asset_get' },
      },
    })
    transport.emit({ event: { type: 'message_delta', text: 'Answer.' } })
    transport.emit({ event: { type: 'done' } })

    expect(screen.getByText('asset_get')).toBeTruthy()
    expect(screen.getByText('Answer.')).toBeTruthy()
  })

  it('hands chart option JSON to the host renderer without touching it', async () => {
    const option = { series: [{ type: 'bar', data: [1] }] }
    const renderChart = vi.fn(() => <div data-testid='host-chart' />)
    const transport = new ScriptedTransport()
    mount(transport, { renderChart })
    await send('chart it')
    transport.emit({ event: { type: 'chart', option, title: 'Load' } })

    expect(screen.getByTestId('host-chart')).toBeTruthy()
    expect(renderChart).toHaveBeenCalledWith(
      expect.objectContaining({ option, title: 'Load' }),
      expect.objectContaining({ height: 280 }),
    )
  })

  it('uses the host markdown renderer when one is supplied', async () => {
    const renderMarkdown = vi.fn(() => <div data-testid='host-markdown' />)
    const transport = new ScriptedTransport()
    mount(transport, { renderMarkdown })
    await send('hello')
    transport.emit({ event: { type: 'message_delta', text: 'text' } })

    expect(screen.getByTestId('host-markdown')).toBeTruthy()
    expect(renderMarkdown).toHaveBeenCalledWith('text', { streaming: true })
  })

  it('routes every visible string through the host translate function', () => {
    const t = vi.fn((key: string) => `T:${key}`)
    const transport = new ScriptedTransport()
    mount(transport, { t })
    expect(screen.getByText('T:copilot.dock.title')).toBeTruthy()
  })

  it('renders an approval card for a step waiting on a decision', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('delete it')
    transport.emit({
      event: {
        type: 'step_started',
        step: { id: 's1', title: 'Close work order 55', status: 'awaiting_approval' },
      },
    })
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy()
  })

  it('shows the queue position while the run waits', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('hello')
    transport.emit({ event: { type: 'queued', position: 3 } })
    expect(screen.getByText('Queued at position 3.')).toBeTruthy()
  })

  it('surfaces the run error', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('hello')
    transport.emit({
      event: { type: 'error', error: { message: 'Monthly chat credit limit reached.' } },
    })
    expect(screen.getByRole('alert').textContent).toContain('Monthly chat credit limit')
  })

  it('reports tokens in the footer but hides credits the backend never sends', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('hello')
    transport.emit({ event: { type: 'usage', usage: { tokensIn: 900, tokensOut: 40 } } })

    expect(screen.getByText('900 in / 40 out')).toBeTruthy()
    expect(screen.queryByText(/credits left/)).toBeNull()
  })

  it('shows credits once the backend does send them', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('hello')
    transport.emit({ event: { type: 'usage', usage: { creditsRemaining: 88 } } })
    expect(screen.getByText('88 credits left')).toBeTruthy()
  })

  it('names the transport actually in use', async () => {
    const transport = new ScriptedTransport()
    mount(transport)
    await send('hello')
    act(() => {
      transport.consumeCalls[0]?.onTransportChange?.('agentic')
    })
    expect(screen.getByText('polling')).toBeTruthy()
  })

  it('lists earlier conversations when threads are enabled', async () => {
    const transport = new ScriptedTransport()
    render(
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters()}
        transport={transport}
      >
        <CopilotDock defaultOpen />
      </CopilotProvider>,
    )
    expect(await screen.findByText('Earlier question')).toBeTruthy()
  })

  it('applies host theme tokens as CSS variables', () => {
    const transport = new ScriptedTransport()
    mount(transport, { theme: { accent: 'rgb(1, 2, 3)', colorScheme: 'dark' } })
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.getPropertyValue('--nxcp-accent')).toBe('rgb(1, 2, 3)')
  })

  it('remembers the dock width across mounts', () => {
    window.localStorage.setItem('netix-copilot.width', '512')
    const transport = new ScriptedTransport()
    mount(transport)
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('512px')
  })

  it('clamps a stored width that is out of range', () => {
    window.localStorage.setItem('netix-copilot.width', '9999')
    const transport = new ScriptedTransport()
    mount(transport)
    const dock = document.querySelector('.nxcp-dock') as HTMLElement
    expect(dock.style.width).toBe('720px')
  })
})
