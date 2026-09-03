import { beforeEach, describe, expect, it } from 'vitest'

import { decodeFrame, decodePolledEvent, resetSyntheticStepCounter } from '../transport/decode'

function frame(event: string, data: unknown, id?: string) {
  return { event, data: JSON.stringify(data), ...(id === undefined ? {} : { id }) }
}

describe('decodeFrame', () => {
  beforeEach(() => {
    resetSyntheticStepCounter()
  })

  it('decodes run_started with snake_case fields', () => {
    const out = decodeFrame(
      frame('run_started', { turn_id: 't1', model: 'gpt', credits_remaining: 9 }),
    )
    expect(out?.event).toEqual({
      type: 'run_started',
      turnId: 't1',
      model: 'gpt',
      creditsRemaining: 9,
    })
  })

  it('decodes run_started with camelCase fields too', () => {
    const out = decodeFrame(frame('run_started', { turnId: 't1', creditsRemaining: 3 }))
    expect(out?.event).toMatchObject({ type: 'run_started', turnId: 't1', creditsRemaining: 3 })
  })

  it('drops run_started without a turn id, since nothing downstream can use it', () => {
    expect(decodeFrame(frame('run_started', { model: 'gpt' }))).toBeNull()
  })

  it('decodes queued with a position', () => {
    expect(decodeFrame(frame('queued', { position: 4 }))?.event).toEqual({
      type: 'queued',
      position: 4,
    })
  })

  it('decodes a plan into steps', () => {
    const out = decodeFrame(
      frame('plan', { steps: [{ id: 's1', title: 'Look up asset', tool: 'asset_get' }] }),
    )
    expect(out?.event).toEqual({
      type: 'plan',
      steps: [{ id: 's1', title: 'Look up asset', status: 'pending', tool: 'asset_get' }],
    })
  })

  it('gives plan steps a synthetic id when the backend omits one', () => {
    const out = decodeFrame(frame('plan', { steps: [{ title: 'Step' }, { title: 'Other' }] }))
    const steps = out?.event.type === 'plan' ? out.event.steps : []
    expect(steps.map((step) => step.id)).toEqual(['step-1', 'step-2'])
  })

  it('accepts an empty plan without failing', () => {
    expect(decodeFrame(frame('plan', {}))?.event).toEqual({ type: 'plan', steps: [] })
  })

  it('maps step_result status aliases onto the canonical set', () => {
    const out = decodeFrame(
      frame('step_result', { call_id: 'c1', tool: 'sql', status: 'completed' }),
    )
    expect(out?.event).toMatchObject({ type: 'step_result', step: { id: 'c1', status: 'ok' } })
  })

  it('defaults step_started to running and step_result to ok', () => {
    expect(decodeFrame(frame('step_started', { tool: 'a' }))?.event).toMatchObject({
      step: { status: 'running' },
    })
    expect(decodeFrame(frame('step_result', { tool: 'b' }))?.event).toMatchObject({
      step: { status: 'ok' },
    })
  })

  // ml-engine #316 sends call_id on both halves of a tool call and nothing else that is stable
  // across the pair, so preferring it is what stops one call rendering as two timeline entries.
  it('prefers call_id over any other id, so the two step events collapse into one', () => {
    const started = decodeFrame(
      frame('step_started', { tool: 'sql', call_id: 'call-1', id: 'evt-77', iteration: 0 }),
    )
    const result = decodeFrame(
      frame('step_result', { tool: 'sql', call_id: 'call-1', id: 'evt-78', status: 'completed' }),
    )
    expect(started?.event.type === 'step_started' ? started.event.step.id : '').toBe('call-1')
    expect(result?.event.type === 'step_result' ? result.event.step.id : '').toBe('call-1')
  })

  it('finds call_id at the top level when the step body is nested', () => {
    const out = decodeFrame(frame('step_result', { call_id: 'call-9', step: { tool: 'sql' } }))
    expect(out?.event).toMatchObject({ step: { id: 'call-9' } })
  })

  it('synthesizes an id only when the backend supplied none at all', () => {
    const out = decodeFrame(frame('step_result', { tool: 'sql' }))
    expect(out?.event).toMatchObject({ step: { id: 'step-1' } })
  })

  it('decodes the awaiting_approval step ml-engine parks a gated action in', () => {
    const out = decodeFrame(
      frame('step_started', {
        tool: 'service_request_create',
        call_id: 'call-3',
        title: 'Create a service request',
        status: 'awaiting_approval',
        arguments: '{"asset_id": 5}',
        iteration: 1,
        detail: 'Waiting for the user to approve this action.',
      }),
    )
    expect(out?.event).toMatchObject({
      type: 'step_started',
      step: {
        id: 'call-3',
        title: 'Create a service request',
        status: 'awaiting_approval',
        tool: 'service_request_create',
        argsSummary: '{"asset_id": 5}',
      },
    })
  })

  it('maps the errored status ml-engine sends on a failed step', () => {
    const out = decodeFrame(frame('step_result', { call_id: 'c1', tool: 'sql', status: 'errored' }))
    expect(out?.event).toMatchObject({ step: { status: 'error' } })
  })

  it('keeps the rejected status a declined approval comes back with', () => {
    const out = decodeFrame(
      frame('step_result', { call_id: 'c1', tool: 'sql', status: 'rejected', detail: 'declined' }),
    )
    expect(out?.event).toMatchObject({ step: { status: 'rejected', detail: 'declined' } })
  })

  it('reads a step nested under a step key', () => {
    const out = decodeFrame(frame('step_started', { step: { id: 's9', tool: 'chart' } }))
    expect(out?.event).toMatchObject({ step: { id: 's9', tool: 'chart' } })
  })

  it('summarizes an object arguments payload into one line', () => {
    const out = decodeFrame(
      frame('step_result', { tool: 't', arguments: { asset_id: 17, tags: [1, 2], nested: {} } }),
    )
    expect(out?.event).toMatchObject({
      step: { argsSummary: 'asset_id=17, tags=[2], nested={…}' },
    })
  })

  it('converts a bare duration in seconds into milliseconds', () => {
    const out = decodeFrame(frame('step_result', { tool: 't', duration: 1.25 }))
    expect(out?.event).toMatchObject({ step: { durationMs: 1250 } })
  })

  it('prefers an explicit duration_ms', () => {
    const out = decodeFrame(frame('step_result', { tool: 't', duration_ms: 40, duration: 9 }))
    expect(out?.event).toMatchObject({ step: { durationMs: 40 } })
  })

  it('decodes message_delta from any of the usual text keys', () => {
    for (const key of ['text', 'delta', 'content', 'chunk', 'token']) {
      const out = decodeFrame(frame('message_delta', { [key]: 'x' }))
      expect(out?.event).toEqual({ type: 'message_delta', text: 'x' })
    }
  })

  it('keeps an empty message_delta, which is a legitimate heartbeat of progress', () => {
    expect(decodeFrame(frame('message_delta', { text: '' }))?.event).toEqual({
      type: 'message_delta',
      text: '',
    })
  })

  it('decodes a chart and keeps the option JSON untouched', () => {
    const option = { series: [{ type: 'bar', data: [1, 2] }] }
    const out = decodeFrame(frame('chart', { option, title: 'Load' }))
    expect(out?.event).toEqual({ type: 'chart', option, title: 'Load' })
  })

  // ml-engine wraps the option once, as { chart_config: { ... } }.
  it('decodes the chart_config wrapper ml-engine actually emits', () => {
    const chartConfig = { series: [{ type: 'bar' }] }
    const out = decodeFrame(frame('chart', { chart_config: chartConfig }))
    expect(out?.event).toEqual({ type: 'chart', option: chartConfig })
  })

  it('drops a chart with no option payload', () => {
    expect(decodeFrame(frame('chart', { title: 'nothing' }))).toBeNull()
  })

  it('decodes usage from OpenAI-style token names', () => {
    const out = decodeFrame(frame('usage', { prompt_tokens: 10, completion_tokens: 4 }))
    expect(out?.event).toEqual({ type: 'usage', usage: { tokensIn: 10, tokensOut: 4 } })
  })

  it('decodes the calls, cost and credit balance ml-engine puts inside usage', () => {
    const out = decodeFrame(
      frame('usage', {
        calls: 2,
        prompt_tokens: 900,
        completion_tokens: 40,
        total_tokens: 940,
        cost_usd: 0.012,
        credits_remaining: 88,
      }),
    )
    expect(out?.event).toEqual({
      type: 'usage',
      usage: { calls: 2, tokensIn: 900, tokensOut: 40, costUsd: 0.012, creditsRemaining: 88 },
    })
  })

  it('decodes usage nested under a usage key', () => {
    const out = decodeFrame(frame('usage', { usage: { tokens_in: 1, tokens_out: 2 } }))
    expect(out?.event).toEqual({ type: 'usage', usage: { tokensIn: 1, tokensOut: 2 } })
  })

  it('decodes error from a detail field and defaults the message', () => {
    expect(decodeFrame(frame('error', { detail: 'nope' }))?.event).toEqual({
      type: 'error',
      error: { message: 'nope' },
    })
    expect(decodeFrame(frame('error', {}))?.event).toMatchObject({
      type: 'error',
      error: { message: 'The copilot run failed.' },
    })
  })

  it('decodes cancelled and done', () => {
    expect(decodeFrame(frame('cancelled', { reason: 'user' }))?.event).toEqual({
      type: 'cancelled',
      reason: 'user',
    })
    expect(decodeFrame(frame('done', { turn_id: 't1' }))?.event).toEqual({
      type: 'done',
      turnId: 't1',
    })
  })

  // The run-level facts ride on the terminal payload, because the decoder accepts eleven event
  // names and a twelfth would be dropped without a word.
  it('reads the run summary off done', () => {
    const out = decodeFrame(
      frame('done', {
        turn_id: 't1',
        status: 'completed',
        execution_time: 4.25,
        tools: ['sql_query', 'generate_chart'],
        result_data: { columns: ['a'], data: [{ a: 1 }] },
      }),
    )
    expect(out?.event).toMatchObject({
      type: 'done',
      turnId: 't1',
      executionMs: 4250,
      tools: ['sql_query', 'generate_chart'],
    })
    expect(out?.event.type === 'done' ? out.event.resultData?.rows : []).toEqual([{ a: 1 }])
  })

  it('reads the run summary off error too, so a failed turn still reports its timing', () => {
    const out = decodeFrame(frame('error', { detail: 'nope', execution_time: 2, tools: ['sql'] }))
    expect(out?.event).toMatchObject({
      type: 'error',
      error: { message: 'nope' },
      executionMs: 2000,
      tools: ['sql'],
    })
  })

  it('prefers an explicit millisecond figure over the seconds one', () => {
    const out = decodeFrame(frame('done', { execution_ms: 40, execution_time: 9 }))
    expect(out?.event).toMatchObject({ executionMs: 40 })
  })

  it('leaves the summary out entirely when the terminal payload carries none', () => {
    expect(decodeFrame(frame('done', { turn_id: 't1' }))?.event).toEqual({
      type: 'done',
      turnId: 't1',
    })
  })

  it('ignores a tools list that is empty or not a list of names', () => {
    expect(decodeFrame(frame('done', { tools: [] }))?.event).toEqual({ type: 'done' })
    expect(decodeFrame(frame('done', { tools: 'sql' }))?.event).toEqual({ type: 'done' })
  })

  it('falls back to a type inside the payload when the SSE event name is generic', () => {
    const out = decodeFrame({ event: 'message', data: JSON.stringify({ type: 'done' }) })
    expect(out?.event).toEqual({ type: 'done' })
  })

  it('unwraps a payload nested under data', () => {
    const out = decodeFrame({
      event: 'message_delta',
      data: JSON.stringify({ type: 'message_delta', data: { text: 'inner' } }),
    })
    expect(out?.event).toEqual({ type: 'message_delta', text: 'inner' })
  })

  it('returns null rather than throwing on malformed JSON', () => {
    expect(decodeFrame({ event: 'done', data: '{not json' })).toBeNull()
  })

  it('returns null for an event name outside the vocabulary', () => {
    expect(decodeFrame(frame('heartbeat', {}))).toBeNull()
  })

  it('treats an empty data body as an empty object', () => {
    expect(decodeFrame({ event: 'cancelled', data: '' })?.event).toEqual({ type: 'cancelled' })
  })

  it('carries the frame id through as the resume cursor', () => {
    expect(decodeFrame(frame('done', {}, 'e-12'))?.id).toBe('e-12')
  })
})

// The reasoning trace. ml-engine's plan is free text with no ids, and a newer ml-engine tags every
// step with the specialist that made it and opens and closes each specialist with its own events.
describe('decodeFrame reasoning trace fields', () => {
  beforeEach(() => {
    resetSyntheticStepCounter()
  })

  it('keeps plan strings as lines and never turns them into pending steps', () => {
    const out = decodeFrame(
      frame('plan', {
        steps: ['Read live values for AHU-01', 'List its open work orders'],
        reasoning: 'Two domains are involved.',
      }),
    )
    expect(out?.event).toEqual({
      type: 'plan',
      steps: [],
      lines: ['Read live values for AHU-01', 'List its open work orders'],
      reasoning: 'Two domains are involved.',
    })
  })

  it('still decodes keyed plan entries as steps alongside free lines', () => {
    const out = decodeFrame(
      frame('plan', { steps: [{ id: 's1', title: 'Look up asset' }, 'and then summarise'] }),
    )
    expect(out?.event).toEqual({
      type: 'plan',
      steps: [{ id: 's1', title: 'Look up asset', status: 'pending' }],
      lines: ['and then summarise'],
    })
  })

  it('decodes the route, the answering agent and the start time off run_started', () => {
    const out = decodeFrame(
      frame('run_started', {
        turn_id: 't1',
        route: 'direct',
        agent: 'FacilitiesAgent',
        started_at: 1725000000000,
      }),
    )
    expect(out?.event).toEqual({
      type: 'run_started',
      turnId: 't1',
      route: 'direct',
      agent: 'FacilitiesAgent',
      startedAt: 1725000000000,
    })
  })

  it('drops a route outside the two ml-engine takes', () => {
    const out = decodeFrame(frame('run_started', { turn_id: 't1', route: 'magic' }))
    expect(out?.event).toEqual({ type: 'run_started', turnId: 't1' })
  })

  it('decodes agent_started with snake_case keys', () => {
    const out = decodeFrame(
      frame('agent_started', {
        agent: 'FacilitiesAgent',
        call_id: 'c1',
        parent_call_id: 'c0',
        task: 'Read live values for AHU-01',
        feedback: 'Include alarms',
        started_at: 1000,
      }),
    )
    expect(out?.event).toEqual({
      type: 'agent_started',
      agent: 'FacilitiesAgent',
      callId: 'c1',
      parentId: 'c0',
      task: 'Read live values for AHU-01',
      feedback: 'Include alarms',
      startedAt: 1000,
    })
  })

  it('decodes agent_started with camelCase keys too', () => {
    const out = decodeFrame(
      frame('agent_started', { agent: 'AssetAgent', callId: 'c2', task: 'List', startedAt: 5 }),
    )
    expect(out?.event).toEqual({
      type: 'agent_started',
      agent: 'AssetAgent',
      callId: 'c2',
      task: 'List',
      startedAt: 5,
    })
  })

  it('drops an agent lifecycle event without an agent or a call id', () => {
    expect(decodeFrame(frame('agent_started', { call_id: 'c1' }))).toBeNull()
    expect(decodeFrame(frame('agent_finished', { agent: 'AssetAgent' }))).toBeNull()
  })

  it('decodes agent_finished, mapping completed to ok and errored to error', () => {
    const out = decodeFrame(
      frame('agent_finished', {
        agent: 'FacilitiesAgent',
        call_id: 'c1',
        status: 'completed',
        duration_ms: 3200,
        tools_used: ['realtime_data_retrieve', 'alarm_log_list'],
        response_chars: 412,
        chart_available: true,
        finished_at: 4200,
      }),
    )
    expect(out?.event).toEqual({
      type: 'agent_finished',
      agent: 'FacilitiesAgent',
      callId: 'c1',
      status: 'ok',
      durationMs: 3200,
      toolsUsed: ['realtime_data_retrieve', 'alarm_log_list'],
      responseChars: 412,
      chartAvailable: true,
      finishedAt: 4200,
    })
    const failed = decodeFrame(
      frame('agent_finished', { agent: 'FacilitiesAgent', callId: 'c1', status: 'errored' }),
    )
    expect(failed?.event).toMatchObject({ status: 'error' })
  })

  it('tags a call_*_agent step as an agent and any other tool as a tool', () => {
    const agent = decodeFrame(
      frame('step_started', { tool: 'call_facilities_agent', call_id: 'c1' }),
    )
    expect(agent?.event).toMatchObject({ step: { id: 'c1', kind: 'agent' } })
    const tool = decodeFrame(frame('step_started', { tool: 'data_query_retrieve', call_id: 'c2' }))
    expect(tool?.event).toMatchObject({ step: { id: 'c2', kind: 'tool' } })
  })

  it('decodes the lineage and timing a tagged backend stamps on step events', () => {
    const out = decodeFrame(
      frame('step_result', {
        tool: 'realtime_data_retrieve',
        call_id: 's1',
        status: 'completed',
        agent: 'FacilitiesAgent',
        parent_call_id: 'c1',
        depth: 1,
        started_at: 1100,
        finished_at: 1310,
        duration_ms: 210,
      }),
    )
    expect(out?.event).toMatchObject({
      step: {
        id: 's1',
        status: 'ok',
        kind: 'tool',
        agent: 'FacilitiesAgent',
        parentId: 'c1',
        depth: 1,
        startedAt: 1100,
        finishedAt: 1310,
        durationMs: 210,
      },
    })
  })

  it('decodes the expiry an approval step carries', () => {
    const out = decodeFrame(
      frame('step_started', {
        tool: 'service_request_create',
        call_id: 'c3',
        status: 'awaiting_approval',
        expires_at: 1725000300000,
      }),
    )
    expect(out?.event).toMatchObject({
      step: { status: 'awaiting_approval', expiresAt: 1725000300000 },
    })
  })

  it('decodes the error cause and drops one it does not know', () => {
    const out = decodeFrame(
      frame('error', { code: 'budget', detail: 'Out of credit.', cause: 'budget' }),
    )
    expect(out?.event).toEqual({
      type: 'error',
      error: { message: 'Out of credit.', code: 'budget', cause: 'budget' },
    })
    const odd = decodeFrame(frame('error', { detail: 'x', cause: 'cosmic rays' }))
    expect(odd?.event).toEqual({ type: 'error', error: { message: 'x' } })
  })
})

describe('decodePolledEvent', () => {
  it('decodes a polled row shaped as { event, ... }', () => {
    const out = decodePolledEvent({ event: 'message_delta', text: 'hi', id: '3' })
    expect(out).toEqual({ event: { type: 'message_delta', text: 'hi' }, id: '3' })
  })

  it('accepts a cursor key in place of an id', () => {
    expect(decodePolledEvent({ type: 'done', cursor: 'c9' })?.id).toBe('c9')
  })

  it('returns null for a non-object row', () => {
    expect(decodePolledEvent('nope')).toBeNull()
  })
})
