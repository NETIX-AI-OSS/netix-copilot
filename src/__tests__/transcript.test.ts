// Replaying stored history. The fixtures mirror what ml-engine's serializers actually return:
// AgenticMLRequest, where one row is a whole thread, and ConversationTurn, where one row is a
// single turn. Both were read off service/serializers.py on feat/copilot-w2-memory-and-actions.

import { describe, expect, it } from 'vitest'

import type { CopilotRunRow } from '../transport/transcript'
import { mapUsage, mergeSteps, transcriptFromRequest, turnFromRow } from '../transport/transcript'

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

describe('mapUsage', () => {
  it('returns nothing for an absent usage column', () => {
    expect(mapUsage(null)).toEqual({})
    expect(mapUsage(undefined)).toEqual({})
  })

  it('ignores keys of the wrong type instead of coercing them', () => {
    expect(mapUsage({ calls: '2', credits_remaining: 'lots' })).toEqual({})
  })
})
