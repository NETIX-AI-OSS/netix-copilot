import { describe, expect, it } from 'vitest'

import {
  applyEnveloped,
  applyEvent,
  initialRunState,
  isRunActive,
  isRunFinished,
} from '../runtime/run-store'
import { buildTraceTree } from '../runtime/trace-model'
import { readRunSummary } from '../transport/transcript'
import type { CopilotEvent, PlanStep, RunState } from '../types'

function reduce(events: CopilotEvent[], from: RunState = initialRunState()): RunState {
  return events.reduce(applyEvent, from)
}

const AGENT_STARTED: CopilotEvent = {
  type: 'agent_started',
  agent: 'FacilitiesAgent',
  callId: 'c1',
  task: 'Read live values for AHU-01',
  startedAt: 1000,
}

// What an untagged backend streams: the meta-tool and the specialist's call, both flat.
const FLAT_STREAM: CopilotEvent[] = [
  { type: 'run_started', turnId: 't1' },
  {
    type: 'step_started',
    step: {
      id: 'c1',
      title: 'call_facilities_agent',
      tool: 'call_facilities_agent',
      status: 'running',
      kind: 'agent',
    },
  },
  {
    type: 'step_started',
    step: {
      id: 's1',
      title: 'realtime_data_retrieve',
      tool: 'realtime_data_retrieve',
      status: 'running',
      kind: 'tool',
    },
  },
  {
    type: 'step_result',
    step: {
      id: 's1',
      title: 'realtime_data_retrieve',
      status: 'ok',
      kind: 'tool',
      durationMs: 210,
    },
  },
  {
    type: 'step_result',
    step: {
      id: 'c1',
      title: 'call_facilities_agent',
      status: 'ok',
      kind: 'agent',
      durationMs: 3200,
    },
  },
  { type: 'message_delta', text: 'AHU-01 is healthy.' },
]

// The same run as the stored row rebuilds it once the run has ended.
const REBUILT_STEPS: PlanStep[] = [
  {
    id: 'c1',
    title: 'Read live values for AHU-01',
    tool: 'call_facilities_agent',
    status: 'ok',
    kind: 'agent',
    agent: 'FacilitiesAgent',
    task: 'Read live values for AHU-01',
    durationMs: 3200,
  },
  {
    id: 's1',
    title: 'realtime_data_retrieve',
    tool: 'realtime_data_retrieve',
    status: 'ok',
    kind: 'tool',
    agent: 'FacilitiesAgent',
    parentId: 'c1',
    depth: 1,
    output: { values: [18.2] },
  },
]

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

describe('run-store reasoning trace', () => {
  it('records the route, the answering agent and the start time from run_started', () => {
    const state = reduce([
      { type: 'run_started', turnId: 't1', route: 'direct', agent: 'AssetAgent', startedAt: 99 },
    ])
    expect(state).toMatchObject({ route: 'direct', agent: 'AssetAgent', startedAt: 99 })
  })

  it('keeps the plan as the model wrote it: reasoning and lines, never pending steps', () => {
    const state = reduce([
      { type: 'plan', steps: [], lines: ['Read values', 'Summarise'], reasoning: 'Two domains.' },
    ])
    expect(state.hasPlan).toBe(true)
    expect(state.steps).toEqual([])
    expect(state.plan).toEqual({ lines: ['Read values', 'Summarise'], reasoning: 'Two domains.' })
  })

  it('leaves the plan unset when a keyed plan carries no lines', () => {
    const state = reduce([{ type: 'plan', steps: [{ id: 's1', title: 'One', status: 'pending' }] }])
    expect(state.hasPlan).toBe(true)
    expect(state.plan).toBeUndefined()
  })

  it('opens the agent card over the meta-tool step that arrived first', () => {
    const state = reduce([FLAT_STREAM[1]!, AGENT_STARTED])
    expect(state.steps).toEqual([
      {
        id: 'c1',
        title: 'Read live values for AHU-01',
        tool: 'call_facilities_agent',
        status: 'running',
        kind: 'agent',
        agent: 'FacilitiesAgent',
        task: 'Read live values for AHU-01',
        startedAt: 1000,
      },
    ])
  })

  it('opens the agent card even when agent_started outran the meta-tool step', () => {
    const state = reduce([AGENT_STARTED])
    expect(state.steps).toHaveLength(1)
    expect(state.steps[0]).toMatchObject({ id: 'c1', kind: 'agent', status: 'running' })
    const bare = reduce([{ type: 'agent_started', agent: 'AssetAgent', callId: 'c9' }])
    expect(bare.steps[0]?.title).toBe('AssetAgent')
  })

  it('leaves queued once a specialist starts working', () => {
    const state = reduce([{ type: 'queued', position: 1 }, AGENT_STARTED])
    expect(state.status).toBe('streaming')
  })

  it('closes the card on agent_finished and keeps the task as its title', () => {
    const state = reduce([
      AGENT_STARTED,
      {
        type: 'agent_finished',
        agent: 'FacilitiesAgent',
        callId: 'c1',
        status: 'error',
        durationMs: 400,
        finishedAt: 1400,
      },
    ])
    expect(state.steps[0]).toMatchObject({
      id: 'c1',
      title: 'Read live values for AHU-01',
      status: 'error',
      durationMs: 400,
      finishedAt: 1400,
      startedAt: 1000,
    })
  })

  it('nests a tagged child under its agent while live', () => {
    const state = reduce([
      AGENT_STARTED,
      {
        type: 'step_started',
        step: {
          id: 's1',
          title: 'realtime_data_retrieve',
          status: 'running',
          kind: 'tool',
          parentId: 'c1',
          agent: 'FacilitiesAgent',
        },
      },
    ])
    const tree = buildTraceTree(state.steps)
    expect(tree.map((node) => node.step.id)).toEqual(['c1'])
    expect(tree[0]?.children.map((node) => node.step.id)).toEqual(['s1'])
  })

  it('merges the stored trace into the terminal event without reordering what streamed', () => {
    const live = reduce(FLAT_STREAM)
    const state = applyEvent(live, {
      type: 'done',
      steps: [
        ...REBUILT_STEPS,
        { id: 's2', title: 'alarm_log_list', status: 'ok', kind: 'tool', parentId: 'c1' },
      ],
    })
    expect(state.steps.map((step) => step.id)).toEqual(['c1', 's1', 's2'])
    expect(state.steps[0]).toMatchObject({
      agent: 'FacilitiesAgent',
      task: 'Read live values for AHU-01',
    })
    expect(state.steps[1]).toMatchObject({ parentId: 'c1', output: { values: [18.2] } })
    expect(state.rebuilt).toBe(true)
  })

  it('does not call it a rebuild when the summary only confirms what streamed', () => {
    const tagged = reduce([
      AGENT_STARTED,
      { type: 'step_result', step: { ...REBUILT_STEPS[1]!, output: undefined } as PlanStep },
    ])
    const state = applyEvent(tagged, { type: 'done', steps: REBUILT_STEPS })
    expect(state.rebuilt).toBeUndefined()
    expect(state.steps[1]?.output).toEqual({ values: [18.2] })
  })

  it('takes the stored plan only when the stream carried none', () => {
    const stored = { lines: ['from the row'], reasoning: 'stored' }
    const fresh = reduce([{ type: 'done', plan: stored }])
    expect(fresh.plan).toEqual(stored)
    expect(fresh.hasPlan).toBe(true)
    const streamed = reduce([
      { type: 'plan', steps: [], lines: ['from the wire'] },
      { type: 'done', plan: stored },
    ])
    expect(streamed.plan).toEqual({ lines: ['from the wire'] })
  })

  // An old backend streams every call flat. The trace stays flat until the run ends and the stored
  // sub_execution_log says which specialist made which call; then it nests. Every call was seen
  // live, so that is a confirmation, not a rebuild.
  it('renders an untagged stream flat, then nests it from the terminal read-back', () => {
    const live = reduce(FLAT_STREAM)
    expect(buildTraceTree(live.steps).map((node) => node.step.id)).toEqual(['c1', 's1'])
    expect(live.steps.every((step) => step.parentId === undefined)).toBe(true)
    expect(live.rebuilt).toBeUndefined()

    const done = applyEvent(live, { type: 'done', steps: REBUILT_STEPS, executionMs: 6500 })
    const tree = buildTraceTree(done.steps)
    expect(tree.map((node) => node.step.id)).toEqual(['c1'])
    expect(tree[0]?.children.map((node) => node.step.id)).toEqual(['s1'])
    expect(done.steps[0]?.title).toBe('Read live values for AHU-01')
    expect(done).toMatchObject({ status: 'done', executionMs: 6500 })
    expect(done.rebuilt).toBeUndefined()
  })

  // ml-engine's synthetic plan_trace marker for a direct route never streams, so the read-back
  // must neither draw it as a specialist card nor count it as a missed event.
  it('reads a direct-routed run back without a phantom specialist or a rebuilt chip', () => {
    const live = reduce([
      { type: 'run_started', turnId: 't1', route: 'direct', agent: 'FacilitiesAgent' },
      {
        type: 'step_started',
        step: {
          id: 'call_a1',
          title: 'realtime_data_retrieve',
          tool: 'realtime_data_retrieve',
          status: 'running',
          kind: 'tool',
        },
      },
      {
        type: 'step_result',
        step: { id: 'call_a1', title: 'realtime_data_retrieve', status: 'ok', kind: 'tool' },
      },
    ])
    const summary = readRunSummary({
      plan: [
        {
          tool: 'call_facilities_agent',
          call_id: 'direct-facilities-77',
          status: 'completed',
          detail: 'deterministic single-domain route',
        },
      ],
      execution_log: [
        {
          tool: 'realtime_data_retrieve',
          call_id: 'call_a1',
          arguments: { tag_ids: [1] },
          output: {},
        },
      ],
    })
    const done = applyEvent(live, { type: 'done', ...summary })
    expect(done.steps.map((step) => step.id)).toEqual(live.steps.map((step) => step.id))
    expect(done.steps.some((step) => step.kind === 'agent')).toBe(false)
    expect(done.rebuilt).toBeUndefined()
    expect(done).toMatchObject({ route: 'direct', agent: 'FacilitiesAgent' })
  })

  // The stream shows make_plan as a running row; the stored row turns it into the plan. Once the
  // plan is known the row goes, so the finished trace matches the one a replay rebuilds.
  it('drops the live make_plan row once the terminal event carries the plan', () => {
    const live = reduce([
      { type: 'run_started', turnId: 't1' },
      {
        type: 'step_started',
        step: { id: 'p0', title: 'make_plan', tool: 'make_plan', status: 'running', kind: 'tool' },
      },
      { type: 'step_result', step: { id: 'p0', title: 'make_plan', status: 'ok', kind: 'tool' } },
      { type: 'plan', steps: [], lines: ['Read live values'] },
      ...FLAT_STREAM.slice(1),
    ])
    expect(live.steps.map((step) => step.id)).toEqual(['p0', 'c1', 's1'])
    const done = applyEvent(live, {
      type: 'done',
      steps: REBUILT_STEPS,
      plan: { lines: ['Read live values'] },
    })
    expect(done.steps.map((step) => step.id)).toEqual(['c1', 's1'])
    expect(done.rebuilt).toBeUndefined()
    // Without a stored plan there is nothing to stand in for the row, so it stays.
    const kept = applyEvent(live, { type: 'done', steps: REBUILT_STEPS })
    expect(kept.steps.map((step) => step.id)).toEqual(['p0', 'c1', 's1'])
  })
})
