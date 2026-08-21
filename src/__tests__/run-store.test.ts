import { describe, expect, it } from 'vitest'

import {
  applyEnveloped,
  applyEvent,
  initialRunState,
  isRunActive,
  isRunFinished,
} from '../runtime/run-store'
import type { CopilotEvent, RunState } from '../types'

function reduce(events: CopilotEvent[], from: RunState = initialRunState()): RunState {
  return events.reduce(applyEvent, from)
}

describe('run-store', () => {
  it('starts idle with nothing in it', () => {
    const state = initialRunState()
    expect(state).toEqual({
      status: 'idle',
      hasPlan: false,
      steps: [],
      text: '',
      charts: [],
      offline: false,
    })
  })

  it('moves to streaming on run_started and records the turn', () => {
    const state = reduce([{ type: 'run_started', turnId: 't1', model: 'gpt-x' }])
    expect(state.status).toBe('streaming')
    expect(state.turnId).toBe('t1')
    expect(state.model).toBe('gpt-x')
  })

  it('records credits from run_started into usage', () => {
    const state = reduce([{ type: 'run_started', turnId: 't1', creditsRemaining: 12 }])
    expect(state.usage).toEqual({ creditsRemaining: 12 })
  })

  it('tracks a queue position', () => {
    const state = reduce([{ type: 'queued', position: 3 }])
    expect(state).toMatchObject({ status: 'queued', queuePosition: 3 })
  })

  it('completes a run that never sends a plan, since the direct router skips the orchestrator', () => {
    const state = reduce([
      { type: 'run_started', turnId: 't1' },
      { type: 'message_delta', text: 'All good.' },
      { type: 'done' },
    ])
    expect(state.hasPlan).toBe(false)
    expect(state.steps).toEqual([])
    expect(state.text).toBe('All good.')
    expect(state.status).toBe('done')
  })

  it('marks hasPlan and seeds the steps when a plan does arrive', () => {
    const state = reduce([{ type: 'plan', steps: [{ id: 's1', title: 'One', status: 'pending' }] }])
    expect(state.hasPlan).toBe(true)
    expect(state.steps).toHaveLength(1)
  })

  it('updates a planned step in place rather than appending a duplicate', () => {
    const state = reduce([
      { type: 'plan', steps: [{ id: 's1', title: 'Fetch tags', status: 'pending' }] },
      { type: 'step_started', step: { id: 's1', title: 'Fetch tags', status: 'running' } },
      {
        type: 'step_result',
        step: { id: 's1', title: 'Fetch tags', status: 'ok', durationMs: 120 },
      },
    ])
    expect(state.steps).toEqual([{ id: 's1', title: 'Fetch tags', status: 'ok', durationMs: 120 }])
  })

  it('keeps planned detail that a later step event omits', () => {
    const state = reduce([
      {
        type: 'plan',
        steps: [{ id: 's1', title: 'Planned title', status: 'pending', tool: 'sql' }],
      },
      { type: 'step_result', step: { id: 's1', title: 'Planned title', status: 'ok' } },
    ])
    expect(state.steps[0]?.tool).toBe('sql')
  })

  it('appends an unplanned step that only shows up at execution time', () => {
    const state = reduce([
      { type: 'plan', steps: [{ id: 's1', title: 'One', status: 'pending' }] },
      { type: 'step_result', step: { id: 's2', title: 'Two', status: 'ok' } },
    ])
    expect(state.steps.map((step) => step.id)).toEqual(['s1', 's2'])
  })

  it('concatenates message deltas in arrival order', () => {
    const state = reduce([
      { type: 'message_delta', text: 'Hel' },
      { type: 'message_delta', text: 'lo ' },
      { type: 'message_delta', text: 'there' },
    ])
    expect(state.text).toBe('Hello there')
  })

  it('leaves queued as soon as real output starts', () => {
    const state = reduce([
      { type: 'queued', position: 2 },
      { type: 'message_delta', text: 'x' },
    ])
    expect(state.status).toBe('streaming')
  })

  it('collects charts and ignores a repeat of the same chart id', () => {
    const option = { series: [] }
    const state = reduce([
      { type: 'chart', option, chartId: 'c1', title: 'Load' },
      { type: 'chart', option, chartId: 'c1' },
    ])
    expect(state.charts).toEqual([{ id: 'c1', option, title: 'Load' }])
  })

  it('gives charts a positional id when the backend omits one', () => {
    const state = reduce([
      { type: 'chart', option: { a: 1 } },
      { type: 'chart', option: { b: 2 } },
    ])
    expect(state.charts.map((chart) => chart.id)).toEqual(['chart-1', 'chart-2'])
  })

  it('merges successive usage events instead of replacing them', () => {
    const state = reduce([
      { type: 'usage', usage: { tokensIn: 10 } },
      { type: 'usage', usage: { tokensOut: 4, costUsd: 0.01 } },
    ])
    expect(state.usage).toEqual({ tokensIn: 10, tokensOut: 4, costUsd: 0.01 })
  })

  it('records an error and clears the offline flag', () => {
    const offline: RunState = { ...initialRunState(), offline: true, status: 'paused' }
    const state = applyEvent(offline, { type: 'error', error: { message: 'boom' } })
    expect(state).toMatchObject({ status: 'error', offline: false })
    expect(state.error?.message).toBe('boom')
  })

  it('records cancellation', () => {
    expect(reduce([{ type: 'cancelled' }]).status).toBe('cancelled')
  })

  it('stores the resume cursor from an enveloped event', () => {
    const state = applyEnveloped(initialRunState(), {
      event: { type: 'message_delta', text: 'a' },
      id: 'e7',
    })
    expect(state.lastEventId).toBe('e7')
  })

  it('advances the cursor even when the event changed nothing', () => {
    const base = { ...initialRunState(), charts: [{ id: 'c1', option: {} }] }
    const state = applyEnveloped(base, {
      event: { type: 'chart', option: {}, chartId: 'c1' },
      id: 'e9',
    })
    expect(state.lastEventId).toBe('e9')
    expect(state.charts).toHaveLength(1)
  })

  it('classifies which statuses hold a connection open', () => {
    const at = (status: RunState['status']) => ({ ...initialRunState(), status })
    expect(isRunActive(at('creating'))).toBe(true)
    expect(isRunActive(at('queued'))).toBe(true)
    expect(isRunActive(at('streaming'))).toBe(true)
    expect(isRunActive(at('paused'))).toBe(false)
    expect(isRunActive(at('idle'))).toBe(false)
    expect(isRunActive(at('done'))).toBe(false)
  })

  it('separates finished from merely paused', () => {
    const at = (status: RunState['status']) => ({ ...initialRunState(), status })
    expect(isRunFinished(at('done'))).toBe(true)
    expect(isRunFinished(at('error'))).toBe(true)
    expect(isRunFinished(at('cancelled'))).toBe(true)
    expect(isRunFinished(at('paused'))).toBe(false)
  })
})
