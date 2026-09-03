// Replaying stored history. The fixtures mirror what ml-engine's serializers actually return:
// AgenticMLRequest, where one row is a whole thread, and ConversationTurn, where one row is a
// single turn. Both were read off service/serializers.py on feat/copilot-w2-memory-and-actions.

import { describe, expect, it } from 'vitest'

import { buildTraceTree } from '../runtime/trace-model'
import type { CopilotRunRow } from '../transport/transcript'
import {
  mapUsage,
  mergeSteps,
  readRunSummary,
  rebuildRun,
  transcriptFromRequest,
  turnFromRow,
} from '../transport/transcript'

const REQUEST_ROW: CopilotRunRow = {
  id: 101,
  status: 1,
  prompt_text: 'top 5 technicians last week',
  response_text: 'Ali closed the most.',
  created_on: '2026-08-20T10:00:00Z',
  messages: [
    { role: 'user', content: 'top 5 technicians last week' },
    { role: 'assistant', content: 'Ali closed the most.' },
  ],
  plan: [{ tool: 'sql_query', call_id: 'c1', status: 'completed', arguments: { limit: 5 } }],
  execution_log: [
    {
      tool: 'sql_query',
      call_id: 'c1',
      iteration: 0,
      arguments: { limit: 5 },
      output: { columns: ['technician', 'closed'], data: [{ technician: 'Ali', closed: 12 }] },
    },
  ],
  tools: ['sql_query'],
  execution_time: 4.25,
  chart_available: true,
  chart_config: { series: [{ type: 'bar' }] },
  usage: { calls: 2, prompt_tokens: 900, completion_tokens: 40, credits_remaining: 88 },
}

describe('transcriptFromRequest', () => {
  it('rebuilds the exchange from the stored message array', () => {
    const turns = transcriptFromRequest(REQUEST_ROW, '101')
    expect(turns).toHaveLength(1)
    expect(turns[0]?.prompt).toBe('top 5 technicians last week')
    expect(turns[0]?.run.text).toBe('Ali closed the most.')
  })

  it('pairs each user message with the answer that followed it', () => {
    const turns = transcriptFromRequest(
      {
        ...REQUEST_ROW,
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'one' },
          { role: 'user', content: 'second' },
          { role: 'assistant', content: 'two' },
        ],
      },
      '101',
    )
    expect(turns.map((turn) => [turn.prompt, turn.run.text])).toEqual([
      ['first', 'one'],
      ['second', 'two'],
    ])
  })

  it('replays the plan, the chart and the result table, not just the prose', () => {
    const run = transcriptFromRequest(REQUEST_ROW, '101')[0]?.run
    expect(run?.hasPlan).toBe(true)
    expect(run?.charts).toHaveLength(1)
    expect(run?.charts[0]?.option).toEqual({ series: [{ type: 'bar' }] })
    expect(run?.resultData?.columns).toEqual(['technician', 'closed'])
    expect(run?.resultData?.rows).toEqual([{ technician: 'Ali', closed: 12 }])
  })

  it('replays the status, the tools and the timing', () => {
    const run = transcriptFromRequest(REQUEST_ROW, '101')[0]?.run
    expect(run?.status).toBe('done')
    expect(run?.tools).toEqual(['sql_query'])
    expect(run?.executionMs).toBe(4250)
  })

  it('replays credits alongside the stored token counts', () => {
    const usage = transcriptFromRequest(REQUEST_ROW, '101')[0]?.run.usage
    expect(usage).toEqual({ calls: 2, tokensIn: 900, tokensOut: 40, creditsRemaining: 88 })
  })

  it('shows one timeline entry per tool call, not one per source column', () => {
    // plan_trace and execution_log both describe call c1.
    const steps = transcriptFromRequest(REQUEST_ROW, '101')[0]?.run.steps
    expect(steps).toHaveLength(1)
    expect(steps?.[0]?.id).toBe('c1')
  })

  it('falls back to prompt_text and response_text when messages are empty', () => {
    const turns = transcriptFromRequest({ ...REQUEST_ROW, messages: [] }, '101')
    expect(turns).toHaveLength(1)
    expect(turns[0]?.prompt).toBe('top 5 technicians last week')
    expect(turns[0]?.run.text).toBe('Ali closed the most.')
  })

  it('parses a messages array stored as JSON text', () => {
    const turns = transcriptFromRequest(
      { ...REQUEST_ROW, messages: JSON.stringify([{ role: 'user', content: 'stored' }]) },
      '101',
    )
    expect(turns[0]?.prompt).toBe('stored')
  })

  it('ignores tool and system messages, which are not part of the transcript', () => {
    const turns = transcriptFromRequest(
      {
        ...REQUEST_ROW,
        messages: [
          { role: 'system', content: 'you are a copilot' },
          { role: 'user', content: 'ask' },
          { role: 'tool', tool_call_id: 'c1', content: '{"rows":[]}' },
          { role: 'assistant', content: 'answer' },
        ],
      },
      '101',
    )
    expect(turns).toHaveLength(1)
    expect(turns[0]?.run.text).toBe('answer')
  })

  it('survives a messages column that is neither an array nor valid JSON', () => {
    expect(transcriptFromRequest({ ...REQUEST_ROW, messages: '{oops' }, '101')).toHaveLength(1)
    expect(transcriptFromRequest({ ...REQUEST_ROW, messages: 7 }, '101')).toHaveLength(1)
  })

  it('carries a stored error onto the turn', () => {
    const run = transcriptFromRequest(
      { ...REQUEST_ROW, status: 2, error: 'Monthly chat credit limit reached.' },
      '101',
    )[0]?.run
    expect(run?.status).toBe('error')
    expect(run?.error?.message).toBe('Monthly chat credit limit reached.')
  })

  it('maps every stored status onto a run status', () => {
    const statuses = [0, 1, 2, 3, 4].map(
      (status) => transcriptFromRequest({ ...REQUEST_ROW, status }, '1')[0]?.run.status,
    )
    expect(statuses).toEqual(['queued', 'done', 'error', 'streaming', 'cancelled'])
  })

  it('suppresses a chart the backend explicitly marked unavailable', () => {
    const run = transcriptFromRequest({ ...REQUEST_ROW, chart_available: false }, '101')[0]?.run
    expect(run?.charts).toEqual([])
  })

  it('prefers the stored result_data field when the backend does populate it', () => {
    const run = transcriptFromRequest(
      { ...REQUEST_ROW, result_data: { columns: ['x'], data: [{ x: 9 }] } },
      '101',
    )[0]?.run
    expect(run?.resultData?.rows).toEqual([{ x: 9 }])
  })

  it('leaves an assistant-first thread with an empty prompt rather than inventing one', () => {
    const turns = transcriptFromRequest(
      { ...REQUEST_ROW, messages: [{ role: 'assistant', content: 'briefing' }] },
      '101',
    )
    expect(turns[0]?.prompt).toBe('')
    expect(turns[0]?.run.text).toBe('briefing')
  })

  it('falls back to now when the row carries no usable timestamp', () => {
    const turns = transcriptFromRequest(
      { ...REQUEST_ROW, created_on: undefined, updated_on: undefined },
      '101',
    )
    expect(turns[0]?.createdAt).toBeGreaterThan(0)
  })
})

describe('turnFromRow', () => {
  const TURN_ROW: CopilotRunRow = {
    id: 9,
    status: 1,
    prompt_text: 'what is the status?',
    response_text: 'Open.',
    created_on: '2026-08-21T09:00:00Z',
    tools: ['work_order_retrieve'],
    execution_time: 1.5,
    model: 'gpt-4.1-mini',
    execution_log: [{ tool: 'work_order_retrieve', call_id: 'c9', arguments: { id: 55 } }],
  }

  it('rebuilds one ConversationTurn row into one turn', () => {
    const turn = turnFromRow(TURN_ROW, '3', 0)
    expect(turn.id).toBe('9')
    expect(turn.prompt).toBe('what is the status?')
    expect(turn.run.text).toBe('Open.')
    expect(turn.run.tools).toEqual(['work_order_retrieve'])
    expect(turn.run.executionMs).toBe(1500)
    expect(turn.run.model).toBe('gpt-4.1-mini')
    expect(turn.run.steps.map((step) => step.id)).toEqual(['c9'])
  })

  it('falls back to a positional id when the row carries none', () => {
    expect(turnFromRow({ ...TURN_ROW, id: undefined }, '3', 2).id).toBe('3-2')
  })
})

describe('mergeSteps', () => {
  it('fills gaps rather than overwriting a known field with an absent one', () => {
    const merged = mergeSteps([
      { id: 'c1', title: 'sql_query', status: 'pending', tool: 'sql_query' },
      { id: 'c1', title: 'sql_query', status: 'ok' },
    ])
    expect(merged).toEqual([{ id: 'c1', title: 'sql_query', status: 'ok', tool: 'sql_query' }])
  })
})

// A stored orchestrated run, as ml-engine persists it: plan_trace on `plan` (flat, orchestrator
// level, make_plan included), execution_log with the make_plan output and one call_*_agent entry
// per specialist, each carrying its sub_execution_log under the same call_ids the stream used.
const ORCHESTRATED_ROW: CopilotRunRow = {
  id: 44,
  status: 1,
  prompt_text: 'Summarise AHU-01 and its open work orders',
  response_text: 'AHU-01 is healthy; two work orders are open.',
  created_on: '2026-09-01T08:00:00Z',
  plan: [
    {
      tool: 'make_plan',
      call_id: 'p0',
      iteration: 0,
      status: 'completed',
      arguments: { steps: ['Read live values for AHU-01'], reasoning: 'Two domains are involved.' },
      duration_ms: 12,
      started_at: 1000,
      finished_at: 1012,
    },
    {
      tool: 'call_facilities_agent',
      call_id: 'a1',
      iteration: 0,
      status: 'completed',
      arguments: { task: 'Read live values and active alarms for AHU-01' },
      duration_ms: 3200,
      started_at: 1000,
      finished_at: 4200,
    },
    {
      tool: 'call_work_orders_agent',
      call_id: 'a2',
      iteration: 0,
      status: 'completed',
      arguments: { task: 'List open work orders for AHU-01', feedback: 'Include PPM' },
    },
  ],
  execution_log: [
    {
      tool: 'make_plan',
      call_id: 'p0',
      iteration: 0,
      arguments: { steps: ['Read live values for AHU-01'], reasoning: 'Two domains are involved.' },
      output: {
        steps: ['Read live values for AHU-01', 'List its open work orders', 'Summarise both'],
        reasoning: 'Two domains are involved.',
      },
    },
    {
      tool: 'call_facilities_agent',
      call_id: 'a1',
      iteration: 0,
      arguments: { task: 'Read live values and active alarms for AHU-01' },
      output: {
        specialist: 'FacilitiesAgent',
        response: 'Supply air is 18.2 C with no active alarms.',
        tools_used: ['realtime_data_retrieve', 'alarm_log_list'],
        chart_config: null,
        sub_execution_log: [
          {
            tool: 'realtime_data_retrieve',
            call_id: 's1',
            iteration: 0,
            status: 'ok',
            arguments: { tag_ids: [1, 2] },
            output: { values: [18.2] },
            duration_ms: 210,
            started_at: 1100,
            finished_at: 1310,
          },
          {
            tool: 'alarm_log_list',
            call_id: 's2',
            iteration: 1,
            status: 'error',
            output: { error: 'upstream 502' },
          },
        ],
      },
    },
    {
      tool: 'call_work_orders_agent',
      call_id: 'a2',
      iteration: 0,
      arguments: { task: 'List open work orders for AHU-01', feedback: 'Include PPM' },
      output: {
        specialist: 'WorkOrdersAgent',
        response: '',
        tools_used: ['reactive_work_order_list'],
        chart_config: null,
        sub_execution_log: [{ tool: 'reactive_work_order_list', iteration: 0, status: 'ok' }],
      },
    },
  ],
  tools: ['call_facilities_agent', 'call_work_orders_agent', 'realtime_data_retrieve'],
  execution_time: 6.5,
}

describe('rebuildRun', () => {
  const rebuilt = rebuildRun(ORCHESTRATED_ROW)

  it('turns the make_plan entry into the plan as the model wrote it, not a step', () => {
    expect(rebuilt.plan).toEqual({
      reasoning: 'Two domains are involved.',
      lines: ['Read live values for AHU-01', 'List its open work orders', 'Summarise both'],
    })
    expect(rebuilt.steps.some((step) => step.tool === 'make_plan')).toBe(false)
  })

  it('names the specialist and its task on each call_*_agent step', () => {
    const facilities = rebuilt.steps.find((step) => step.id === 'a1')
    expect(facilities).toMatchObject({
      kind: 'agent',
      agent: 'FacilitiesAgent',
      task: 'Read live values and active alarms for AHU-01',
      title: 'Read live values and active alarms for AHU-01',
      status: 'ok',
      durationMs: 3200,
      startedAt: 1000,
      finishedAt: 4200,
    })
    const workOrders = rebuilt.steps.find((step) => step.id === 'a2')
    expect(workOrders).toMatchObject({
      kind: 'agent',
      agent: 'WorkOrdersAgent',
      feedback: 'Include PPM',
      status: 'ok',
    })
  })

  // A specialist that died is stored the way base.py stores any failed tool: the trace entry says
  // errored with the message as detail, and the log output carries `error`. Both must agree.
  it('keeps a failed specialist failed, with the stored detail', () => {
    const failed = rebuildRun({
      plan: [
        {
          tool: 'call_work_orders_agent',
          call_id: 'a2',
          status: 'errored',
          detail: 'CAFM timed out',
          arguments: { task: 'List open work orders' },
        },
      ],
      execution_log: [
        {
          tool: 'call_work_orders_agent',
          call_id: 'a2',
          arguments: { task: 'List open work orders' },
          output: { error: 'CAFM timed out' },
        },
      ],
    })
    expect(failed.steps).toHaveLength(1)
    expect(failed.steps[0]).toMatchObject({
      kind: 'agent',
      status: 'error',
      detail: 'CAFM timed out',
      task: 'List open work orders',
      output: { error: 'CAFM timed out' },
    })
    expect(failed.steps[0]?.agent).toBeUndefined()
  })

  it('nests every sub_execution_log entry under its agent with the stored output', () => {
    const tree = buildTraceTree(rebuilt.steps)
    expect(tree.map((node) => node.step.id)).toEqual(['a1', 'a2'])
    expect(tree[0]?.children.map((node) => node.step.id)).toEqual(['s1', 's2'])
    expect(tree[0]?.children[0]?.step).toEqual({
      id: 's1',
      title: 'realtime_data_retrieve',
      tool: 'realtime_data_retrieve',
      status: 'ok',
      kind: 'tool',
      agent: 'FacilitiesAgent',
      parentId: 'a1',
      depth: 1,
      argsSummary: 'tag_ids=[2]',
      output: { values: [18.2] },
      durationMs: 210,
      startedAt: 1100,
      finishedAt: 1310,
    })
    expect(tree[0]?.children[1]?.step).toMatchObject({
      status: 'error',
      output: { error: 'upstream 502' },
    })
  })

  it('derives an id from the parent for a child an older backend stored without one', () => {
    const tree = buildTraceTree(rebuilt.steps)
    expect(tree[1]?.children.map((node) => node.step.id)).toEqual(['a2-0'])
    expect(tree[1]?.children[0]?.step).toMatchObject({
      tool: 'reactive_work_order_list',
      parentId: 'a2',
      agent: 'WorkOrdersAgent',
      status: 'ok',
    })
  })

  it('shows a plan stored as free strings as lines and never as pending steps', () => {
    expect(rebuildRun({ plan: ['Look it up', 'Answer'] })).toEqual({
      steps: [],
      plan: { lines: ['Look it up', 'Answer'] },
    })
  })

  it('keeps a direct-routed run as one agent card with nothing beneath it', () => {
    const direct = rebuildRun({
      plan: [
        {
          tool: 'call_facilities_agent',
          call_id: 'direct-facilities-9',
          iteration: 0,
          status: 'completed',
          detail: 'deterministic single-domain route',
        },
      ],
      execution_log: [
        { tool: 'realtime_data_retrieve', call_id: 'c1', arguments: { tag_ids: [1] }, output: {} },
      ],
    })
    expect(direct.plan).toBeUndefined()
    expect(direct.steps.map((step) => [step.id, step.kind])).toEqual([
      ['direct-facilities-9', 'agent'],
      ['c1', 'tool'],
    ])
  })

  it('rebuilds identically whichever row grouping is read', () => {
    expect(turnFromRow(ORCHESTRATED_ROW, '7', 0).run.steps).toEqual(rebuilt.steps)
    expect(transcriptFromRequest(ORCHESTRATED_ROW, '44')[0]?.run.steps).toEqual(rebuilt.steps)
    expect(turnFromRow(ORCHESTRATED_ROW, '7', 0).run).toMatchObject({
      hasPlan: true,
      plan: rebuilt.plan,
    })
  })

  it('rides on the run summary so a live run nests when it ends', () => {
    const summary = readRunSummary(ORCHESTRATED_ROW)
    expect(summary.steps).toEqual(rebuilt.steps)
    expect(summary.plan).toEqual(rebuilt.plan)
    expect(readRunSummary({ id: 1 }).steps).toBeUndefined()
  })
})

describe('mapUsage', () => {
  it('returns nothing for an absent usage column', () => {
    expect(mapUsage(null)).toEqual({})
    expect(mapUsage(undefined)).toEqual({})
  })

  it('ignores keys of the wrong type instead of coercing them', () => {
    expect(mapUsage({ calls: '2', credits_remaining: 'lots' })).toEqual({})
  })
})
