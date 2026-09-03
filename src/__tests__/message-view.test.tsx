// The assistant block's anatomy: meta row, trace mount point, answer, artifacts, banners.

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { CopilotProvider } from '../adapters/context'
import type { CopilotAdapters } from '../adapters/types'
import { MessageView } from '../components/message-view'
import type { ReasoningTraceProps } from '../components/reasoning-trace'
import { toCsv } from '../components/result-table'
import type { CopilotTurnView } from '../runtime/engine'
import { initialRunState } from '../runtime/run-store'
import type { CopilotTransport, CreatedTurn } from '../transport/types'
import type { RunState } from '../types'
import { testAdapters } from './helpers'

// The trace is another module's; the transcript only has to mount it with the right props.
vi.mock('../components/reasoning-trace', () => ({
  ReasoningTrace: ({ run, defaultOpen }: ReasoningTraceProps) => (
    <div data-testid='trace' data-open={String(defaultOpen)} data-status={run.status} />
  ),
}))

class QuietTransport implements CopilotTransport {
  readonly name = 'sse' as const

  async createTurn(): Promise<CreatedTurn> {
    return { turnId: 't1' }
  }

  consumeRun(): Promise<void> {
    return new Promise<void>(() => undefined)
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

function turn(run: Partial<RunState>, createdAt = Date.UTC(2026, 8, 3, 9, 5)): CopilotTurnView {
  return {
    id: 'turn-1',
    prompt: 'why is AHU-1 offline?',
    createdAt,
    run: { ...initialRunState(), status: 'done', ...run },
  }
}

function mount(children: ReactNode, overrides: Partial<CopilotAdapters> = {}) {
  return render(
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters(overrides)}
      transport={new QuietTransport()}
    >
      {children}
    </CopilotProvider>,
  )
}

describe('meta row', () => {
  it('names the assistant through the host title and stamps the time', () => {
    mount(<MessageView turn={turn({ text: 'It lost power.' })} />)
    const meta = document.querySelector('.nxcp-assistant-meta') as HTMLElement
    expect(meta.querySelector('.nxcp-assistant-name')?.textContent).toBe('Copilot')
    expect(meta.querySelector('.nxcp-avatar svg')).toBeTruthy()
    const time = meta.querySelector('time') as HTMLTimeElement
    expect(time.getAttribute('dateTime')).toBe('2026-09-03T09:05:00.000Z')
    expect(time.textContent).toBe(
      new Date(Date.UTC(2026, 8, 3, 9, 5)).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    )
  })

  it('keeps the user bubble to what the user typed', () => {
    mount(
      <MessageView
        turn={{ ...turn({ text: 'x' }), wirePrompt: 'why is AHU-1 offline? ASSET_ID: 17' }}
      />,
    )
    expect(document.querySelector('.nxcp-bubble')?.textContent).toBe('why is AHU-1 offline?')
    expect(screen.queryByText(/ASSET_ID/)).toBeNull()
  })

  it('shows the tier chip only above Base', () => {
    const { rerender } = mount(<MessageView turn={turn({ modelTier: 'high' })} />)
    expect(screen.getByText('High 5x').className).toBe('nxcp-assistant-chip')
    rerender(
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters()}
        transport={new QuietTransport()}
      >
        <MessageView turn={turn({ modelTier: 'base' })} />
      </CopilotProvider>,
    )
    expect(screen.queryByText('Base 1x')).toBeNull()
  })

  it('flags a failed run in the meta row and keeps the alert with the backend message', () => {
    mount(<MessageView turn={turn({ status: 'error', error: { message: 'Budget exceeded.' } })} />)
    const chip = screen.getByText('Request failed')
    expect(chip.getAttribute('data-tone')).toBe('warning')
    expect(screen.getByRole('alert').textContent).toBe('Budget exceeded.')
  })

  it('flags a cancelled run once, in the meta row', () => {
    mount(<MessageView turn={turn({ status: 'cancelled' })} />)
    expect(screen.getAllByText('Cancelled.')).toHaveLength(1)
    expect(screen.getByText('Cancelled.').getAttribute('data-tone')).toBe('warning')
  })

  it('leaves the queue position to the trace header', () => {
    mount(<MessageView turn={turn({ status: 'queued', queuePosition: 2 })} />)
    expect(screen.getByTestId('trace').dataset.status).toBe('queued')
    expect(screen.queryByText('Queued at position 2.')).toBeNull()
  })
})

describe('reasoning trace mount', () => {
  it('opens the trace while the run is live', () => {
    mount(<MessageView turn={turn({ status: 'streaming' })} />)
    const trace = screen.getByTestId('trace')
    expect(trace.getAttribute('data-open')).toBe('true')
    expect(trace.getAttribute('data-status')).toBe('streaming')
  })

  it('mounts a finished or replayed trace collapsed', () => {
    mount(<MessageView turn={turn({ status: 'done' })} />)
    expect(screen.getByTestId('trace').getAttribute('data-open')).toBe('false')
  })

  it('sits between the meta row and the answer', () => {
    mount(<MessageView turn={turn({ text: 'Answer.' })} />)
    const block = document.querySelector('.nxcp-assistant') as HTMLElement
    const order = [...block.children].map((child) => child.className || child.dataset.testid)
    expect(order).toEqual(['nxcp-assistant-meta', 'trace', 'nxcp-answer', 'nxcp-actions'])
  })
})

describe('answer body', () => {
  it('shows the streaming caret only while text is still arriving', () => {
    const { rerender } = mount(<MessageView turn={turn({ status: 'streaming', text: 'It' })} />)
    expect(document.querySelector('.nxcp-answer .nxcp-caret')).toBeTruthy()
    rerender(
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters()}
        transport={new QuietTransport()}
      >
        <MessageView turn={turn({ status: 'done', text: 'It lost power.' })} />
      </CopilotProvider>,
    )
    expect(document.querySelector('.nxcp-caret')).toBeNull()
  })

  it('hands the text to the host markdown renderer when there is one', () => {
    const renderMarkdown = vi.fn(() => <em data-testid='host-md'>rendered</em>)
    mount(<MessageView turn={turn({ status: 'streaming', text: '**bold**' })} />, {
      renderMarkdown,
    })
    expect(screen.getByTestId('host-md')).toBeTruthy()
    expect(renderMarkdown).toHaveBeenCalledWith('**bold**', { streaming: true })
  })
})

describe('artifacts', () => {
  it('wraps every chart in a card titled after the chart', () => {
    const renderChart = vi.fn(() => <canvas data-testid='chart' />)
    mount(
      <MessageView
        turn={turn({
          charts: [
            { id: 'c1', option: { series: [] }, title: 'Supply temperature' },
            { id: 'c2', option: { series: [] } },
          ],
        })}
      />,
      { renderChart },
    )
    expect(screen.getByRole('region', { name: 'Supply temperature' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Chart' })).toBeTruthy()
    expect(document.querySelectorAll('.nxcp-artifact .nxcp-chart')).toHaveLength(2)
    expect(renderChart).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1' }),
      expect.objectContaining({ height: 280, streaming: false }),
    )
  })

  it('wraps the result table in a card of its own', () => {
    mount(
      <MessageView
        turn={turn({
          resultData: { columns: ['a'], rows: [{ a: 1 }, { a: 2 }], raw: null },
        })}
      />,
    )
    const card = screen.getByRole('region', { name: 'Result' })
    expect(card.querySelector('table')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeTruthy()
  })

  it('renders approval cards for every step waiting on a decision', () => {
    mount(
      <MessageView
        turn={turn({
          status: 'streaming',
          steps: [
            { id: 's1', title: 'Close work order 55', status: 'awaiting_approval' },
            { id: 's2', title: 'Read live values', status: 'ok' },
          ],
        })}
      />,
    )
    expect(screen.getByRole('region', { name: 'Approval required' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
  })

  it('shows the offline banner while the run is paused', () => {
    mount(<MessageView turn={turn({ status: 'paused', offline: true })} />)
    expect(screen.getByText(/Offline\./)).toBeTruthy()
  })
})

describe('CSV export', () => {
  const createObjectURL = vi.fn(() => 'blob:copilot')
  const click = vi.fn()

  beforeAll(() => {
    // jsdom ships neither object URLs nor navigation, and the export needs both.
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    HTMLAnchorElement.prototype.click = click
  })

  it('exports every row with quoting, not only the ten on screen', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      name: index === 0 ? 'Ali "The Wrench", Sr.' : `tech-${index}`,
      closed: index,
    }))
    const notify = vi.fn()
    mount(
      <MessageView turn={turn({ resultData: { columns: ['name', 'closed'], rows, raw: null } })} />,
      { notify },
    )
    expect(screen.getAllByRole('row')).toHaveLength(11)

    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(click).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith({ message: 'Table exported — 12 rows' })

    const csv = toCsv({ columns: ['name', 'closed'], rows, raw: null })
    const lines = csv.split('\n')
    expect(lines).toHaveLength(13)
    expect(lines[0]).toBe('"name","closed"')
    expect(lines[1]).toBe('"Ali ""The Wrench"", Sr.","0"')
    expect(lines[12]).toBe('"tech-11","11"')
  })

  it('leaves a missing cell empty rather than printing undefined', () => {
    expect(toCsv({ columns: ['a', 'b'], rows: [{ a: 1 }], raw: null })).toBe('"a","b"\n"1",""')
  })
})
