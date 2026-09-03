// The three things a host lost when it adopted v0.1.0: result tables, the run facts under an
// answer and replayed history. Each of them renders here from a turn alone, so any host
// composing from the exported primitives gets them without rebuilding anything.

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { CopilotProvider, useCopilotState } from '../adapters/context'
import { CopilotDock } from '../components/dock'
import { MessageView } from '../components/message-view'
import { ThreadList } from '../components/thread-list'
import type { CopilotTurnView } from '../runtime/engine'
import { initialRunState } from '../runtime/run-store'
import type { CopilotTranscriptTurn, CopilotTransport, CreatedTurn } from '../transport/types'
import type { RunState } from '../types'
import { testAdapters } from './helpers'

class QuietTransport implements CopilotTransport {
  readonly name = 'agentic' as const
  thread: CopilotTranscriptTurn[] = []

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
    return [{ id: 'th1', title: 'Earlier question', updatedAt: 1 }]
  }

  hold = false

  async fetchThread(): Promise<CopilotTranscriptTurn[]> {
    if (this.hold) return new Promise<CopilotTranscriptTurn[]>(() => undefined)
    return this.thread
  }
}

function turn(run: Partial<RunState>): CopilotTurnView {
  return {
    id: 'turn-1',
    prompt: 'top 5 technicians last week',
    createdAt: 1,
    run: { ...initialRunState(), status: 'done', ...run },
  }
}

function mount(children: ReactNode, transport = new QuietTransport()) {
  return render(
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters()}
      transport={transport}
    >
      {children}
    </CopilotProvider>,
  )
}

describe('result tables', () => {
  it('renders the rows behind the prose answer', () => {
    mount(
      <MessageView
        turn={turn({
          text: 'Ali closed the most.',
          resultData: {
            columns: ['technician', 'closed'],
            rows: [
              { technician: 'Ali', closed: 12 },
              { technician: 'Sam', closed: 9 },
            ],
            raw: null,
          },
        })}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'technician' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Ali' })).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('caps the table and says how much it is hiding', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ n: index }))
    mount(<MessageView turn={turn({ resultData: { columns: ['n'], rows, raw: null } })} />)
    expect(screen.getAllByRole('row')).toHaveLength(11)
    expect(screen.getByText('Showing the first 10 of 25 rows.')).toBeTruthy()
  })

  it('prints a scalar result instead of an empty table', () => {
    mount(<MessageView turn={turn({ resultData: { columns: [], rows: [], raw: 42 } })} />)
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders nothing at all for a scalar with no value', () => {
    mount(<MessageView turn={turn({ resultData: { columns: [], rows: [], raw: null } })} />)
    expect(screen.queryByText('Result')).toBeNull()
    expect(document.querySelector('.nxcp-artifact')).toBeNull()
  })

  it('renders a missing cell as blank rather than as undefined', () => {
    mount(
      <MessageView
        turn={turn({ resultData: { columns: ['a', 'b'], rows: [{ a: 1 }], raw: null } })}
      />,
    )
    expect(screen.queryByText('undefined')).toBeNull()
  })

  it('stays out of the way when the host renders its own table', () => {
    mount(
      <MessageView
        showResultData={false}
        turn={turn({ resultData: { columns: ['a'], rows: [{ a: 1 }], raw: null } })}
      />,
    )
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('answer strip', () => {
  it('reports the tools the run used and the time it took', () => {
    mount(
      <MessageView turn={turn({ executionMs: 4250, tools: ['sql_query', 'generate_chart'] })} />,
    )
    expect(screen.getByText('Used 2 tools · 4.3 s')).toBeTruthy()
  })

  it('counts the specialists the orchestrator consulted', () => {
    mount(
      <MessageView
        turn={turn({
          executionMs: 12_400,
          tools: ['call_facilities_agent', 'realtime_data_retrieve'],
          steps: [
            { id: 'a1', title: 'Facilities', tool: 'call_facilities_agent', status: 'ok' },
            { id: 'c1', title: 'live', tool: 'realtime_data_retrieve', status: 'ok' },
          ],
        })}
      />,
    )
    expect(screen.getByText('Used 2 tools · 1 specialists · 12.4 s')).toBeTruthy()
  })

  it('falls back to the steps that ran when the summary names no tools', () => {
    mount(
      <MessageView
        turn={turn({
          executionMs: 900,
          steps: [{ id: 'c1', title: 'sql_query', tool: 'sql_query', status: 'ok' }],
        })}
      />,
    )
    expect(screen.getByText('Used 1 tools · 0.9 s')).toBeTruthy()
  })

  it('marks a failed run as failed without claiming grounding', () => {
    mount(
      <MessageView
        turn={turn({ status: 'error', error: { message: 'boom' }, executionMs: 900 })}
      />,
    )
    expect(screen.getByText('Request failed')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('boom')
    expect(screen.queryByText(/Used /)).toBeNull()
  })

  it('holds the strip back while the run is still going', () => {
    mount(<MessageView turn={turn({ status: 'streaming', executionMs: 4250, text: 'so far' })} />)
    expect(screen.queryByText(/Used /)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
  })

  it('stays out of the way when the host renders its own chips', () => {
    mount(<MessageView showBadges={false} turn={turn({ tools: ['sql_query'], executionMs: 1 })} />)
    expect(screen.queryByText(/Used /)).toBeNull()
  })
})

describe('history replay', () => {
  it('restores a stored turn with its plan, chart and table intact', async () => {
    const transport = new QuietTransport()
    transport.thread = [
      {
        id: 'th1-0',
        prompt: 'earlier question',
        createdAt: 1,
        run: {
          ...initialRunState(),
          status: 'done',
          hasPlan: true,
          text: 'earlier answer',
          steps: [{ id: 'c1', title: 'sql_query', tool: 'sql_query', status: 'ok' }],
          charts: [{ id: 'c', option: { series: [] } }],
          tools: ['sql_query'],
          executionMs: 2000,
          resultData: { columns: ['a'], rows: [{ a: 1 }], raw: null },
        },
      },
    ]
    mount(<Replay />, transport)

    // Picking a stored conversation is all a host does; the SDK fetches and rebuilds it.
    fireEvent.click(await screen.findByText('Earlier question'))

    expect(await screen.findByText('earlier answer')).toBeTruthy()
    expect(screen.getByText('earlier question')).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('Used 1 tools · 2.0 s')).toBeTruthy()
  })

  it('says so in the dock while the transcript is still on its way', async () => {
    const transport = new QuietTransport()
    transport.hold = true
    mount(<CopilotDock open />, transport)
    fireEvent.click(await screen.findByText('Earlier question'))
    expect(screen.getByText('Restoring this conversation…')).toBeTruthy()
  })
})

// The thread list is the host-facing entry point into selectThread.
function Replay() {
  const state = useCopilotState()
  return (
    <div>
      <ThreadList />
      {state.threadLoading ? <p>Restoring this conversation…</p> : null}
      {state.turns.map((entry) => (
        <MessageView key={entry.id} turn={entry} />
      ))}
    </div>
  )
}
