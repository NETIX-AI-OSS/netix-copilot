// The live ml-engine contract. These fixtures mirror the real AgenticMLRequest resource:
// status 0/1/2/3/4, a whole-run snapshot on every poll, execution_log entries shaped
// { tool, call_id, iteration, arguments, output }, and plan entries carrying a status.

import { describe, expect, it, vi } from 'vitest'

import {
  AGENTIC_STATUS,
  AgenticTransport,
  decodeCursor,
  encodeCursor,
} from '../transport/agentic-transport'
import type { EnvelopedEvent } from '../types'
import { errorResponse, instantSleep, jsonResponse } from './helpers'

function transportWith(responses: Response[], overrides = {}) {
  const fetchImpl = vi.fn(async () => responses.shift() ?? jsonResponse({ status: 1 }))
  const transport = new AgenticTransport({
    baseUrl: 'https://ml.example.com',
    fetchImpl: fetchImpl as unknown as (input: string, init?: RequestInit) => Promise<Response>,
    getIdentity: () => ({ organizationId: 7, userId: 42 }),
    sleepImpl: instantSleep,
    ...overrides,
  })
  return { transport, fetchImpl }
}

async function collect(transport: AgenticTransport, turnId = '101'): Promise<EnvelopedEvent[]> {
  const events: EnvelopedEvent[] = []
  const controller = new AbortController()
  await transport.consumeRun({
    turnId,
    signal: controller.signal,
    onEvent: (enveloped) => events.push(enveloped),
  })
  return events
}

describe('AgenticTransport thread reads', () => {
  // Same rule as the streaming transport: a 404 is a cluster with no thread store, not a failure.
  it('reads an empty list and an empty transcript when the route is missing', async () => {
    const { transport } = transportWith([errorResponse(404), errorResponse(404)])
    expect(await transport.listThreads()).toEqual([])
    expect(await transport.fetchThread('4')).toEqual([])
  })

  it('still raises anything that is not a missing route', async () => {
    const { transport } = transportWith([errorResponse(500, 'boom')])
    await expect(transport.listThreads()).rejects.toThrow(/status 500/)
  })
})

describe('AgenticTransport.createTurn', () => {
  it('posts the org and user the live endpoint demands', async () => {
    const { transport, fetchImpl } = transportWith([jsonResponse({ id: 101, status: 0 }, 201)])
    const created = await transport.createTurn({ prompt: 'why is AHU-1 offline?' })

    expect(created).toEqual({ turnId: '101', threadId: '101' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ml.example.com/api/agentic-ml-request/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      organization_id: 7,
      user_id: 42,
      prompt_text: 'why is AHU-1 offline?',
    })
  })

  it('sends an Idempotency-Key so a retried create replays instead of running twice', async () => {
    const { transport, fetchImpl } = transportWith([jsonResponse({ id: 1, status: 0 }, 201)])
    await transport.createTurn({ prompt: 'hello' })
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    const headers = init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toMatch(/^nxcp-/)
  })

  it('reuses the key the caller minted for this send, so a retry cannot double-spend', async () => {
    const { transport, fetchImpl } = transportWith([
      jsonResponse({ id: 1, status: 0 }, 201),
      jsonResponse({ id: 1, status: 0 }, 201),
    ])
    await transport.createTurn({ prompt: 'hello', idempotencyKey: 'nxcp-fixed' })
    await transport.createTurn({ prompt: 'hello', idempotencyKey: 'nxcp-fixed' })
    for (const call of fetchImpl.mock.calls) {
      const init = (call as [string, RequestInit])[1]
      expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('nxcp-fixed')
    }
  })

  it('sends an Authorization header rather than relying on cookies', async () => {
    const { transport, fetchImpl } = transportWith([jsonResponse({ id: 1, status: 0 }, 201)], {
      getAuthToken: () => 'tok-123',
    })
    await transport.createTurn({ prompt: 'hello' })
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123')
  })

  it('routes a follow-up to the reply action on the same row', async () => {
    const { transport, fetchImpl } = transportWith([jsonResponse({}, 202)])
    const created = await transport.createTurn({ prompt: 'and the week before?', threadId: '55' })

    expect(created).toEqual({ turnId: '55', threadId: '55' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ml.example.com/api/agentic-ml-request/55/reply/')
    expect(JSON.parse(String(init.body))).toEqual({ message: 'and the week before?' })
  })

  it('refuses to guess the identity the endpoint requires', async () => {
    const { transport } = transportWith([jsonResponse({ id: 1 }, 201)], {
      getIdentity: () => undefined,
    })
    await expect(transport.createTurn({ prompt: 'x' })).rejects.toThrow(/organizationId and userId/)
  })

  it('accepts the identity from the page scope when no provider is configured', async () => {
    const { transport, fetchImpl } = transportWith([jsonResponse({ id: 9, status: 0 }, 201)], {
      getIdentity: () => undefined,
    })
    await transport.createTurn({ prompt: 'x', scope: { organization_id: 3, user_id: 4 } })
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body))).toMatchObject({ organization_id: 3, user_id: 4 })
  })
})

describe('AgenticTransport.consumeRun', () => {
  it('synthesizes the event vocabulary from successive snapshots', async () => {
    const { transport } = transportWith([
      jsonResponse({ id: 101, status: AGENTIC_STATUS.PENDING }),
      jsonResponse({
        id: 101,
        status: AGENTIC_STATUS.PROCESSING,
        plan: [{ tool: 'asset_get', call_id: 'p1', status: 'pending' }],
        execution_log: [
          { tool: 'asset_get', call_id: 'c1', iteration: 0, arguments: { asset_id: 17 } },
        ],
        response_text: 'AHU-1 ',
      }),
      jsonResponse({
        id: 101,
        status: AGENTIC_STATUS.COMPLETED,
        plan: [{ tool: 'asset_get', call_id: 'p1', status: 'completed' }],
        execution_log: [
          { tool: 'asset_get', call_id: 'c1', iteration: 0, arguments: { asset_id: 17 } },
        ],
        response_text: 'AHU-1 is offline.',
        chart_available: true,
        chart_config: { series: [{ type: 'line' }] },
        usage: { calls: 2, prompt_tokens: 900, completion_tokens: 40, cost_usd: 0.012 },
      }),
    ])

    const events = await collect(transport)
    expect(events.map((entry) => entry.event.type)).toEqual([
      'run_started',
      'queued',
      'plan',
      'step_result',
      'message_delta',
      'message_delta',
      'chart',
      'usage',
      'done',
    ])
  })

  it('sends only the newly appended text on each poll', async () => {
    const { transport } = transportWith([
      jsonResponse({ status: AGENTIC_STATUS.PROCESSING, response_text: 'Hello' }),
      jsonResponse({ status: AGENTIC_STATUS.COMPLETED, response_text: 'Hello world' }),
    ])
    const deltas = (await collect(transport))
      .filter((entry) => entry.event.type === 'message_delta')
      .map((entry) => (entry.event.type === 'message_delta' ? entry.event.text : ''))
    expect(deltas).toEqual(['Hello', ' world'])
  })

  it('emits each execution_log entry exactly once across polls', async () => {
    const first = [{ tool: 'a', call_id: 'c1', arguments: {} }]
    const second = [...first, { tool: 'b', call_id: 'c2', arguments: {} }]
    const { transport } = transportWith([
      jsonResponse({ status: AGENTIC_STATUS.PROCESSING, execution_log: first }),
      jsonResponse({ status: AGENTIC_STATUS.PROCESSING, execution_log: second }),
      jsonResponse({ status: AGENTIC_STATUS.COMPLETED, execution_log: second }),
    ])
    const steps = (await collect(transport)).filter((entry) => entry.event.type === 'step_result')
    expect(steps).toHaveLength(2)
    expect(
      steps.map((entry) => (entry.event.type === 'step_result' ? entry.event.step.id : '')),
    ).toEqual(['c1', 'c2'])
  })

  it('summarizes tool arguments onto the step', async () => {
    const { transport } = transportWith([
      jsonResponse({
        status: AGENTIC_STATUS.COMPLETED,
        execution_log: [{ tool: 'sql', call_id: 'c1', arguments: { asset_id: 17, limit: 5 } }],
      }),
    ])
    const step = (await collect(transport)).find((entry) => entry.event.type === 'step_result')
    expect(step?.event.type === 'step_result' ? step.event.step.argsSummary : '').toBe(
      'asset_id=17, limit=5',
    )
  })

  it('turns an ERRORED status into an error event carrying the backend message', async () => {
    const { transport } = transportWith([
      jsonResponse({
        status: AGENTIC_STATUS.ERRORED,
        error: 'Monthly chat credit limit reached. Contact System Administrator.',
      }),
    ])
    const events = await collect(transport)
    const failure = events.find((entry) => entry.event.type === 'error')
    expect(failure?.event.type === 'error' ? failure.event.error.message : '').toContain(
      'Monthly chat credit limit',
    )
  })

  it('turns a CANCELLED status into a cancelled event', async () => {
    const { transport } = transportWith([jsonResponse({ status: AGENTIC_STATUS.CANCELLED })])
    const events = await collect(transport)
    expect(events.some((entry) => entry.event.type === 'cancelled')).toBe(true)
  })

  it('stops polling as soon as the run reaches a terminal status', async () => {
    const { transport, fetchImpl } = transportWith([
      jsonResponse({ status: AGENTIC_STATUS.COMPLETED, response_text: 'done' }),
    ])
    await collect(transport)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('stops when the caller aborts mid-run', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(async () => {
      controller.abort()
      return jsonResponse({ status: AGENTIC_STATUS.PROCESSING })
    })
    const transport = new AgenticTransport({
      baseUrl: 'https://ml.example.com',
      fetchImpl: fetchImpl as unknown as (input: string, init?: RequestInit) => Promise<Response>,
      sleepImpl: instantSleep,
    })
    await transport.consumeRun({
      turnId: '1',
      signal: controller.signal,
      onEvent: () => undefined,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('resumes from a cursor without replaying the answer already shown', async () => {
    const { transport } = transportWith([
      jsonResponse({ status: AGENTIC_STATUS.COMPLETED, response_text: 'Hello world' }),
    ])
    const events: EnvelopedEvent[] = []
    await transport.consumeRun({
      turnId: '1',
      signal: new AbortController().signal,
      onEvent: (entry) => events.push(entry),
      lastEventId: encodeCursor({
        textLength: 5,
        logCount: 0,
        planEmitted: false,
        chartEmitted: false,
        usageSignature: '',
        runStarted: true,
        queuedEmitted: true,
      }),
    })
    const deltas = events
      .filter((entry) => entry.event.type === 'message_delta')
      .map((entry) => (entry.event.type === 'message_delta' ? entry.event.text : ''))
    expect(deltas).toEqual([' world'])
    expect(events.some((entry) => entry.event.type === 'run_started')).toBe(false)
  })

  it('reports the transport it is using', async () => {
    const { transport } = transportWith([jsonResponse({ status: AGENTIC_STATUS.COMPLETED })])
    const names: string[] = []
    await transport.consumeRun({
      turnId: '1',
      signal: new AbortController().signal,
      onEvent: () => undefined,
      onTransportChange: (name) => names.push(name),
    })
    expect(names).toEqual(['agentic'])
  })

  it('ignores an empty chart_config even when chart_available is set', async () => {
    const { transport } = transportWith([
      jsonResponse({ status: AGENTIC_STATUS.COMPLETED, chart_available: true, chart_config: {} }),
    ])
    const events = await collect(transport)
    expect(events.some((entry) => entry.event.type === 'chart')).toBe(false)
  })
})

describe('agentic cursor', () => {
  it('round-trips', () => {
    const cursor = {
      textLength: 12,
      logCount: 3,
      planEmitted: true,
      chartEmitted: false,
      usageSignature: '{"calls":1}',
      runStarted: true,
      queuedEmitted: false,
    }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('falls back to an empty cursor for anything unrecognizable', () => {
    const empty = decodeCursor('not-a-cursor')
    expect(empty.textLength).toBe(0)
    expect(empty.runStarted).toBe(false)
    expect(decodeCursor(undefined).logCount).toBe(0)
  })
})

describe('AgenticTransport run summary', () => {
  it('hangs the tools, the timing and the result table off the done event', async () => {
    const { transport } = transportWith([
      jsonResponse({
        id: 101,
        status: AGENTIC_STATUS.COMPLETED,
        response_text: 'Ali closed the most.',
        tools: ['sql_query'],
        execution_time: 4.25,
        execution_log: [
          {
            tool: 'sql_query',
            call_id: 'c1',
            arguments: { limit: 5 },
            output: {
              columns: ['technician', 'closed'],
              data: [{ technician: 'Ali', closed: 12 }],
            },
          },
        ],
      }),
    ])
    const done = (await collect(transport)).find((entry) => entry.event.type === 'done')
    expect(done?.event).toMatchObject({ tools: ['sql_query'], executionMs: 4250 })
    expect(done?.event.type === 'done' ? done.event.resultData?.rows : []).toEqual([
      { technician: 'Ali', closed: 12 },
    ])
  })

  it('hangs the same summary off an errored run', async () => {
    const { transport } = transportWith([
      jsonResponse({
        status: AGENTIC_STATUS.ERRORED,
        error: 'Monthly chat credit limit reached.',
        tools: ['sql_query'],
        execution_time: 2,
      }),
    ])
    const failure = (await collect(transport)).find((entry) => entry.event.type === 'error')
    expect(failure?.event).toMatchObject({
      error: { message: 'Monthly chat credit limit reached.' },
      tools: ['sql_query'],
      executionMs: 2000,
    })
  })

  // ml-engine computes credits_remaining live and blends it into usage on both transports.
  it('carries the credit balance out of usage instead of dropping it', async () => {
    const { transport } = transportWith([
      jsonResponse({
        status: AGENTIC_STATUS.COMPLETED,
        usage: { calls: 1, prompt_tokens: 10, completion_tokens: 2, credits_remaining: 99 },
      }),
    ])
    const usage = (await collect(transport)).find((entry) => entry.event.type === 'usage')
    expect(usage?.event).toEqual({
      type: 'usage',
      usage: { calls: 1, tokensIn: 10, tokensOut: 2, creditsRemaining: 99 },
    })
  })

  it('renders a failed plan step as failed rather than as one still waiting', async () => {
    const { transport } = transportWith([
      jsonResponse({
        status: AGENTIC_STATUS.COMPLETED,
        plan: [
          { tool: 'a', call_id: 'p1', status: 'errored', detail: 'boom' },
          { tool: 'b', call_id: 'p2', status: 'in_progress' },
        ],
      }),
    ])
    const plan = (await collect(transport)).find((entry) => entry.event.type === 'plan')
    expect(plan?.event.type === 'plan' ? plan.event.steps.map((step) => step.status) : []).toEqual([
      'error',
      'running',
    ])
  })
})

describe('AgenticTransport.fetchThread', () => {
  it('rebuilds a stored request into replayable turns', async () => {
    const { transport, fetchImpl } = transportWith([
      jsonResponse({
        id: 101,
        status: AGENTIC_STATUS.COMPLETED,
        prompt_text: 'top 5 technicians',
        response_text: 'Ali closed the most.',
        created_on: '2026-08-20T10:00:00Z',
        messages: [
          { role: 'user', content: 'top 5 technicians' },
          { role: 'assistant', content: 'Ali closed the most.' },
        ],
        chart_available: true,
        chart_config: { series: [{ type: 'bar' }] },
        tools: ['sql_query'],
        execution_time: 3,
      }),
    ])
    const turns = await transport.fetchThread('101')
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe(
      'https://ml.example.com/api/agentic-ml-request/101/',
    )
    expect(turns).toHaveLength(1)
    expect(turns[0]?.prompt).toBe('top 5 technicians')
    expect(turns[0]?.run.text).toBe('Ali closed the most.')
    expect(turns[0]?.run.charts).toHaveLength(1)
    expect(turns[0]?.run.tools).toEqual(['sql_query'])
  })
})

describe('AgenticTransport unsupported operations', () => {
  it('has no cancel route to call, so cancelling is a local no-op', async () => {
    const { transport, fetchImpl } = transportWith([])
    await expect(transport.cancelTurn('1')).resolves.toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects approvals loudly rather than pretending they were recorded', async () => {
    const { transport } = transportWith([])
    await expect(transport.respondToApproval('9', 'call-1', true)).rejects.toThrow(
      /approvals need the streaming copilot contract/,
    )
  })

  it('lists prior requests as threads', async () => {
    const { transport } = transportWith([
      jsonResponse({
        results: [
          { id: 5, prompt_text: 'why is AHU-1 offline?', updated_on: '2026-08-20T10:00:00Z' },
        ],
      }),
    ])
    const threads = await transport.listThreads()
    expect(threads).toEqual([
      { id: '5', title: 'why is AHU-1 offline?', updatedAt: Date.parse('2026-08-20T10:00:00Z') },
    ])
  })
})
