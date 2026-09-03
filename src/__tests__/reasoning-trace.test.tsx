// Every header row of the plan's state table, the tree the body draws, and the collapse rules.
// The clock is injected everywhere, so no assertion here depends on wall-clock time.

import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CopilotProvider } from '../adapters/context'
import { ReasoningTrace } from '../components/reasoning-trace'
import { applyEvent, initialRunState } from '../runtime/run-store'
import type { CopilotRunRow } from '../transport/transcript'
import { readRunSummary, turnFromRow } from '../transport/transcript'
import type { CopilotTransport } from '../transport/types'
import type { CopilotEvent, PlanStep, RunState } from '../types'
import { testAdapters } from './helpers'

const transport: CopilotTransport = {
  name: 'agentic',
  createTurn: async () => ({ turnId: 't1' }),
  consumeRun: () => new Promise<void>(() => undefined),
  cancelTurn: async () => undefined,
  respondToApproval: async () => undefined,
  listThreads: async () => [],
}

function wrap(children: ReactNode) {
  return (
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters()}
      transport={transport}
    >
      {children}
    </CopilotProvider>
  )
}

const run = (extra: Partial<RunState>): RunState => ({ ...initialRunState(), ...extra })

const step = (id: string, extra: Partial<PlanStep> = {}): PlanStep => ({
  id,
  title: id,
  status: 'ok',
  ...extra,
})

const orchestrated: PlanStep[] = [
  step('plan-1', { tool: 'make_plan', durationMs: 900 }),
  step('call-1', { tool: 'call_facilities_agent', task: 'Read AHU-01', status: 'running' }),
  step('t-1', { tool: 'realtime_data_retrieve', parentId: 'call-1', argsSummary: 'AHU-01' }),
  step('t-2', { tool: 'data_query_retrieve', parentId: 'call-1', status: 'running' }),
]

const label = () => document.querySelector('.nxcp-trace-label')?.textContent
const glyph = () =>
  document.querySelector('.nxcp-trace-toggle .nxcp-glyph')?.getAttribute('data-glyph')
const body = () => document.querySelector<HTMLElement>('.nxcp-trace-body')

let clock = 100_000
const now = () => clock
const tick = (ms: number) => {
  act(() => {
    clock += ms
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  clock = 100_000
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ReasoningTrace header', () => {
  it('renders nothing when there is nothing to say', () => {
    const { container } = render(wrap(<ReasoningTrace run={run({ status: 'idle' })} />))
    expect(container.querySelector('.nxcp-trace')).toBeNull()
    const done = render(wrap(<ReasoningTrace run={run({ status: 'done', executionMs: 1200 })} />))
    expect(done.container.querySelector('.nxcp-trace')).toBeNull()
  })

  it('thinks with dots before any event, and reports the queue position', () => {
    const { rerender } = render(wrap(<ReasoningTrace run={run({ status: 'creating' })} />))
    expect(label()).toBe('Thinking…')
    expect(glyph()).toBe('dots')
    expect(document.querySelectorAll('.nxcp-glyph-dot')).toHaveLength(3)
    rerender(wrap(<ReasoningTrace run={run({ status: 'queued', queuePosition: 3 })} />))
    expect(label()).toBe('Queued at position 3.')
    rerender(wrap(<ReasoningTrace run={run({ status: 'streaming' })} />))
    expect(label()).toBe('Thinking…')
    expect(glyph()).toBe('dots')
  })

  it('plans once the plan arrives and counts settled steps of the tree once they run', () => {
    const plan = { reasoning: 'Two sources are needed.', lines: ['Read live values', 'Compare'] }
    const { rerender } = render(
      wrap(<ReasoningTrace run={run({ status: 'streaming', hasPlan: true, plan })} defaultOpen />),
    )
    expect(label()).toBe('Planning')
    expect(glyph()).toBe('ring')
    expect(body()?.textContent).toContain('Plan')
    expect(body()?.textContent).toContain('Two sources are needed.')
    expect(body()?.querySelectorAll('.nxcp-trace-plan-lines li')).toHaveLength(2)

    const steps = [...orchestrated, step('t-3', { tool: 'generate_chart', status: 'pending' })]
    rerender(
      wrap(
        <ReasoningTrace
          run={run({ status: 'streaming', hasPlan: true, plan, steps })}
          defaultOpen
        />,
      ),
    )
    expect(label()).toBe('Reasoning — step 4 of 5')
    expect(glyph()).toBe('ring')
  })

  it('waits with a shield while a step needs approval, whatever else is running', () => {
    render(
      wrap(
        <ReasoningTrace
          run={run({
            status: 'streaming',
            hasPlan: true,
            steps: [step('a-1', { tool: 'service_request_create', status: 'awaiting_approval' })],
          })}
        />,
      ),
    )
    expect(label()).toBe('Waiting for your approval')
    expect(glyph()).toBe('shield')
  })

  it('summarises a finished run from its reported time, steps and specialists', () => {
    const { rerender } = render(
      wrap(
        <ReasoningTrace
          run={run({ status: 'done', executionMs: 12_400, steps: orchestrated, hasPlan: true })}
        />,
      ),
    )
    expect(label()).toBe('Reasoned for 12.4 s · 4 steps · 1 specialists')
    expect(glyph()).toBe('tick')
    rerender(
      wrap(
        <ReasoningTrace
          run={run({
            status: 'done',
            executionMs: 3_060,
            steps: [step('t-1', { tool: 'execute_code' })],
          })}
        />,
      ),
    )
    expect(label()).toBe('Reasoned for 3.1 s · 1 steps')
  })

  it('spans the step timestamps when the run reported no time, and never invents one', () => {
    const { rerender } = render(
      wrap(
        <ReasoningTrace
          run={run({
            status: 'done',
            startedAt: 5_000,
            steps: [step('t-1', { startedAt: 5_100, finishedAt: 9_300 })],
          })}
        />,
      ),
    )
    expect(label()).toBe('Reasoned for 4.3 s · 1 steps')
    rerender(wrap(<ReasoningTrace run={run({ status: 'done', steps: [step('t-1')] })} />))
    expect(label()).toBe('Reasoned · 1 steps')
  })

  it('reports a stop on error and on cancel with distinct glyphs', () => {
    const steps = [step('t-1'), step('t-2', { status: 'error' })]
    const { rerender } = render(wrap(<ReasoningTrace run={run({ status: 'error', steps })} />))
    expect(label()).toBe('Stopped after 2 steps')
    expect(glyph()).toBe('cross')
    rerender(wrap(<ReasoningTrace run={run({ status: 'cancelled', steps })} />))
    expect(label()).toBe('Stopped after 2 steps')
    expect(glyph()).toBe('stop')
  })

  it('says Working on a direct route, or names the specialist when the backend does', () => {
    const steps = [step('t-1', { tool: 'realtime_data_retrieve', status: 'running' })]
    const { rerender } = render(
      wrap(<ReasoningTrace run={run({ status: 'streaming', route: 'direct', steps })} />),
    )
    expect(label()).toBe('Working')
    expect(glyph()).toBe('ring')
    rerender(
      wrap(
        <ReasoningTrace
          run={run({ status: 'streaming', route: 'direct', agent: 'FacilitiesAgent', steps })}
        />,
      ),
    )
    expect(label()).toBe('Facilities specialist')
  })

  it('marks a trace rebuilt from history', () => {
    render(
      wrap(
        <ReasoningTrace
          run={run({ status: 'done', executionMs: 1000, steps: [step('t-1')], rebuilt: true })}
        />,
      ),
    )
    expect(document.querySelector('.nxcp-trace-chip')?.textContent).toBe('Rebuilt from history')
  })

  it('counts elapsed time from the server start on the injected clock, only while live', () => {
    const { rerender } = render(
      wrap(<ReasoningTrace run={run({ status: 'streaming', startedAt: 99_000 })} now={now} />),
    )
    expect(document.querySelector('.nxcp-trace-elapsed')).toBeNull()
    tick(1000)
    expect(document.querySelector('.nxcp-trace-elapsed')?.textContent).toBe('2.0 s')
    tick(1000)
    expect(document.querySelector('.nxcp-trace-elapsed')?.textContent).toBe('3.0 s')
    rerender(
      wrap(
        <ReasoningTrace
          run={run({ status: 'done', startedAt: 99_000, steps: [step('t-1')] })}
          now={now}
        />,
      ),
    )
    expect(document.querySelector('.nxcp-trace-elapsed')).toBeNull()
    expect(label()).toBe('Reasoned for 3.0 s · 1 steps')
  })

  it('exposes the header as an expander and echoes the label to a settled live region', () => {
    const { rerender } = render(wrap(<ReasoningTrace run={run({ status: 'creating' })} />))
    const toggle = screen.getByRole('button', { expanded: false })
    expect(toggle.getAttribute('aria-controls')).toBe(body()?.id)
    expect(body()?.getAttribute('role')).toBe('group')
    expect(body()?.getAttribute('aria-label')).toBe('Reasoning')
    const live = document.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('Thinking…')
    rerender(wrap(<ReasoningTrace run={run({ status: 'streaming', hasPlan: true })} />))
    expect(live?.textContent).toBe('Thinking…')
    tick(1000)
    expect(live?.textContent).toBe('Planning')
  })
})

// The stream shows make_plan as a running row and the stored row turns it into the plan, so the
// trace a live run ends in and the one a reload rebuilds must draw the same rows.
describe('ReasoningTrace live, finished and replayed', () => {
  const row: CopilotRunRow = {
    id: 9,
    status: 1,
    execution_time: 4,
    plan: [
      { tool: 'make_plan', call_id: 'p0', status: 'completed' },
      {
        tool: 'call_facilities_agent',
        call_id: 'c1',
        status: 'completed',
        arguments: { task: 'Read AHU-01' },
      },
    ],
    execution_log: [
      { tool: 'make_plan', call_id: 'p0', output: { steps: ['Read AHU-01'] } },
      {
        tool: 'call_facilities_agent',
        call_id: 'c1',
        arguments: { task: 'Read AHU-01' },
        output: {
          specialist: 'FacilitiesAgent',
          sub_execution_log: [{ tool: 'realtime_data_retrieve', call_id: 's1', status: 'ok' }],
        },
      },
    ],
  }
  const stream: CopilotEvent[] = [
    { type: 'run_started', turnId: 't1', route: 'orchestrator' },
    {
      type: 'step_started',
      step: { id: 'p0', title: 'make_plan', tool: 'make_plan', status: 'running' },
    },
    { type: 'step_result', step: { id: 'p0', title: 'make_plan', status: 'ok' } },
    { type: 'plan', steps: [], lines: ['Read AHU-01'] },
    {
      type: 'step_started',
      step: {
        id: 'c1',
        title: 'call_facilities_agent',
        tool: 'call_facilities_agent',
        status: 'running',
      },
    },
    {
      type: 'step_started',
      step: {
        id: 's1',
        title: 'realtime_data_retrieve',
        tool: 'realtime_data_retrieve',
        status: 'running',
      },
    },
    { type: 'step_result', step: { id: 's1', title: 'realtime_data_retrieve', status: 'ok' } },
    { type: 'step_result', step: { id: 'c1', title: 'call_facilities_agent', status: 'ok' } },
  ]
  const rows = () =>
    [...document.querySelectorAll('.nxcp-row-label')].map((node) => node.textContent)

  it('draws identical rows and the same header before and after a reload', () => {
    const live = stream.reduce(applyEvent, initialRunState())
    const { rerender } = render(wrap(<ReasoningTrace run={live} defaultOpen />))
    expect(rows()).toEqual(['Planned the approach', 'Read live values'])

    const finished = applyEvent(live, { type: 'done', ...readRunSummary(row) })
    rerender(wrap(<ReasoningTrace run={finished} defaultOpen />))
    const finishedRows = rows()
    const finishedLabel = label()
    expect(finishedRows).toEqual(['Read live values'])
    expect(finishedLabel).toBe('Reasoned for 4.0 s · 2 steps · 1 specialists')
    expect(document.querySelector('.nxcp-trace-chip')).toBeNull()

    const replayed = turnFromRow(row, '9', 0).run
    expect(replayed.steps.map((step) => step.id)).toEqual(finished.steps.map((step) => step.id))
    rerender(wrap(<ReasoningTrace run={replayed} defaultOpen />))
    expect(rows()).toEqual(finishedRows)
    expect(label()).toBe(finishedLabel)
    expect(body()?.querySelectorAll('.nxcp-trace-plan-lines li')).toHaveLength(1)
  })
})

describe('ReasoningTrace body', () => {
  it('nests tool rows under the specialist card that called them', () => {
    render(
      wrap(<ReasoningTrace run={run({ status: 'streaming', steps: orchestrated })} defaultOpen />),
    )
    const nodes = body()!.querySelectorAll(':scope > .nxcp-trace-nodes > .nxcp-trace-node')
    expect([...nodes].map((node) => node.getAttribute('data-kind'))).toEqual(['tool', 'agent'])
    const card = screen.getByRole('region', { name: 'Facilities specialist' })
    expect(card.querySelector('.nxcp-agent-task')?.textContent).toContain('Read AHU-01')
    const rows = card.querySelectorAll('.nxcp-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.querySelector('.nxcp-row-label')?.textContent).toBe('Read live values')
    expect(rows[0]?.querySelector('.nxcp-row-args')?.textContent).toBe('AHU-01')
    expect(rows[1]?.getAttribute('data-status')).toBe('running')
    expect(document.querySelector('.nxcp-row-label')?.textContent).toBe('Planned the approach')
    expect(document.querySelector('.nxcp-row-duration')?.textContent).toBe('900 ms')
  })

  it('renders flat rows when no step carries a parent', () => {
    const steps = [
      step('t-1', { tool: 'alarm_log_list' }),
      step('c-1', { tool: 'call_asset_agent' }),
      step('t-2', { tool: 'execute_code' }),
    ]
    render(wrap(<ReasoningTrace run={run({ status: 'streaming', steps })} defaultOpen />))
    const nodes = body()!.querySelectorAll(':scope > .nxcp-trace-nodes > .nxcp-trace-node')
    expect(nodes).toHaveLength(3)
    expect(
      screen.getByRole('region', { name: 'Asset specialist' }).querySelector('.nxcp-row'),
    ).toBeNull()
  })

  it('highlights an approval row and counts down to its expiry', () => {
    const steps = [
      step('a-1', {
        tool: 'reactive_work_order_create',
        status: 'awaiting_approval',
        expiresAt: 130_000,
      }),
    ]
    render(wrap(<ReasoningTrace run={run({ status: 'streaming', steps })} now={now} />))
    expect(body()?.hidden).toBe(false)
    const row = document.querySelector('.nxcp-row')
    expect(row?.getAttribute('data-status')).toBe('awaiting_approval')
    expect(row?.querySelector('.nxcp-glyph')?.getAttribute('data-glyph')).toBe('shield')
    expect(row?.querySelector('.nxcp-row-label')?.textContent).toBe(
      'Raise a reactive work order · needs approval',
    )
    expect(row?.querySelector('.nxcp-row-expires')).toBeNull()
    tick(1000)
    expect(row?.querySelector('.nxcp-row-expires')?.textContent).toBe('Expires in 29 s')
    tick(30_000)
    expect(row?.querySelector('.nxcp-row-expires')?.textContent).toBe('Expires in 0 s')
  })

  it('expands a row to its detail and, on request, the capped raw output', () => {
    const steps = [
      step('t-1', {
        tool: 'execute_code',
        detail: 'Mean 21.4 °C',
        output: { text: 'x'.repeat(5000) },
      }),
      step('t-2', { tool: 'alarm_log_list' }),
    ]
    render(
      wrap(<ReasoningTrace run={run({ status: 'done', executionMs: 1, steps })} defaultOpen />),
    )
    const heads = document.querySelectorAll('.nxcp-row-head')
    expect(heads[0]?.tagName).toBe('BUTTON')
    expect(heads[1]?.tagName).toBe('DIV')
    const detail = document.querySelector<HTMLElement>('.nxcp-row-detail')
    expect(detail?.hidden).toBe(true)
    fireEvent.click(heads[0]!)
    expect(detail?.hidden).toBe(false)
    expect(heads[0]?.getAttribute('aria-expanded')).toBe('true')
    expect(detail?.textContent).toContain('Mean 21.4 °C')
    expect(document.querySelector('.nxcp-row-raw')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show raw output' }))
    const raw = document.querySelector('.nxcp-row-raw')?.textContent ?? ''
    expect(raw.length).toBe(4001)
    expect(raw.endsWith('…')).toBe(true)
    expect(screen.getByRole('button', { name: 'Hide raw output' })).toBeTruthy()
  })
})

describe('ReasoningTrace collapse rules', () => {
  const live = run({ status: 'streaming', hasPlan: true, steps: orchestrated })
  const finished = run({ status: 'done', executionMs: 5000, hasPlan: true, steps: orchestrated })

  it('opens for a live run and collapses 600 ms after it finishes', () => {
    const { rerender } = render(wrap(<ReasoningTrace run={live} defaultOpen />))
    expect(body()?.hidden).toBe(false)
    rerender(wrap(<ReasoningTrace run={finished} defaultOpen />))
    expect(body()?.hidden).toBe(false)
    tick(599)
    expect(body()?.hidden).toBe(false)
    tick(1)
    expect(body()?.hidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(body()?.hidden).toBe(false)
  })

  it('starts closed for a replayed turn and reads defaultOpen once', () => {
    const { rerender } = render(wrap(<ReasoningTrace run={finished} defaultOpen={false} />))
    expect(body()?.hidden).toBe(true)
    rerender(wrap(<ReasoningTrace run={finished} defaultOpen />))
    expect(body()?.hidden).toBe(true)
  })

  it('does not auto-collapse once the user has toggled it', () => {
    const { rerender } = render(wrap(<ReasoningTrace run={live} defaultOpen />))
    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(body()?.hidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    rerender(wrap(<ReasoningTrace run={finished} defaultOpen />))
    tick(1000)
    expect(body()?.hidden).toBe(false)
  })

  it('stays open on error and on cancel', () => {
    const { rerender } = render(wrap(<ReasoningTrace run={live} defaultOpen />))
    rerender(wrap(<ReasoningTrace run={{ ...live, status: 'error' }} defaultOpen />))
    tick(1000)
    expect(body()?.hidden).toBe(false)
    rerender(wrap(<ReasoningTrace run={{ ...live, status: 'cancelled' }} defaultOpen />))
    tick(1000)
    expect(body()?.hidden).toBe(false)
  })

  it('opens while a step awaits approval even if it started closed', () => {
    const awaiting = run({
      status: 'streaming',
      steps: [step('a-1', { tool: 'memory', status: 'awaiting_approval' })],
    })
    const { rerender } = render(wrap(<ReasoningTrace run={live} defaultOpen={false} />))
    expect(body()?.hidden).toBe(true)
    rerender(wrap(<ReasoningTrace run={awaiting} defaultOpen={false} />))
    expect(body()?.hidden).toBe(false)
  })

  it('clears its timers on unmount', () => {
    const { rerender } = render(wrap(<ReasoningTrace run={live} defaultOpen now={now} />))
    rerender(wrap(<ReasoningTrace run={finished} defaultOpen now={now} />))
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    rerender(wrap(null))
    expect(vi.getTimerCount()).toBe(0)
  })
})
