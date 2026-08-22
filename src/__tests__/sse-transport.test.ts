import { describe, expect, it, vi } from 'vitest'

import { createTransport } from '../transport'
import { AgenticTransport } from '../transport/agentic-transport'
import { AutoTransport } from '../transport/auto-transport'
import { CopilotHttpError } from '../transport/http'
import { DEFAULT_SSE_ENDPOINTS, SseTransport } from '../transport/sse-transport'
import { StreamInterruptedError } from '../transport/types'
import type { EnvelopedEvent } from '../types'
import { errorResponse, frames, instantSleep, jsonResponse, sseResponse } from './helpers'

function sseTransport(responses: Response[], overrides = {}) {
  const fetchImpl = vi.fn(async () => responses.shift() ?? errorResponse(500))
  const transport = new SseTransport({
    baseUrl: 'https://ml.example.com',
    fetchImpl: fetchImpl as unknown as (input: string, init?: RequestInit) => Promise<Response>,
    sleepImpl: instantSleep,
    ...overrides,
  })
  return { transport, fetchImpl }
}

async function collect(transport: SseTransport, options = {}): Promise<EnvelopedEvent[]> {
  const events: EnvelopedEvent[] = []
  await transport.consumeRun({
    turnId: 't1',
    signal: new AbortController().signal,
    onEvent: (entry) => events.push(entry),
    ...options,
  })
  return events
}

// Every string here was read off ml-engine on 2026-08-22: service/urls.py registers the DRF
// routers, service/views.py the @action url_paths, and service/copilot/sse.py the ASGI SSE path.
// The trailing slashes are load-bearing: DRF routes carry one, the ASGI SSE route does not.
describe('DEFAULT_SSE_ENDPOINTS', () => {
  it('names the routes ml-engine registers, trailing slashes included', () => {
    expect(DEFAULT_SSE_ENDPOINTS).toEqual({
      createTurn: '/api/copilot-turn/',
      streamTurn: '/api/copilot/turn/{turnId}/events',
      pollTurn: '/api/copilot-turn/{turnId}/',
      cancelTurn: '/api/copilot-turn/{turnId}/cancel/',
      approval: '/api/copilot-turn/{turnId}/steps/{stepId}/approval/',
      threads: '/api/copilot-conversation/',
      threadTurns: '/api/copilot-turn/?conversation={threadId}',
    })
  })

  // sse.match_turn_id rstrips the path, so a trailing slash would still resolve, but the router
  // dispatches on SSE_PATH_PREFIX + id + SSE_PATH_SUFFIX and that is the spelling create returns.
  it('keeps the SSE tail off the DRF router and off a trailing slash', () => {
    expect(DEFAULT_SSE_ENDPOINTS.streamTurn.startsWith('/api/copilot/turn/')).toBe(true)
    expect(DEFAULT_SSE_ENDPOINTS.streamTurn.endsWith('/events')).toBe(true)
  })

  it('keeps every DRF route on the trailing slash the router requires', () => {
    for (const key of ['createTurn', 'pollTurn', 'cancelTurn', 'approval', 'threads'] as const) {
      expect(DEFAULT_SSE_ENDPOINTS[key].endsWith('/')).toBe(true)
    }
  })
})

describe('SseTransport', () => {
  it('reads a full run off the stream', async () => {
    const { transport } = sseTransport([
      sseResponse(
        frames(
          { event: 'run_started', data: { turn_id: 't1', model: 'gpt' } },
          { event: 'message_delta', data: { text: 'hi' } },
          { event: 'done', data: {} },
        ),
      ),
    ])
    const events = await collect(transport)
    expect(events.map((entry) => entry.event.type)).toEqual([
      'run_started',
      'message_delta',
      'done',
    ])
  })

  it('requests text/event-stream and never falls back to a cookie', async () => {
    const { transport, fetchImpl } = sseTransport(
      [sseResponse(frames({ event: 'done', data: {} }))],
      { getAuthToken: () => 'tok' },
    )
    await collect(transport)
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    const headers = init.headers as Record<string, string>
    expect(headers.Accept).toBe('text/event-stream')
    expect(headers.Authorization).toBe('Bearer tok')
  })

  it('sends Last-Event-ID when resuming', async () => {
    const { transport, fetchImpl } = sseTransport([
      sseResponse(frames({ event: 'done', data: {} })),
    ])
    await collect(transport, { lastEventId: 'e-42' })
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>)['Last-Event-ID']).toBe('e-42')
  })

  it('omits Last-Event-ID on a fresh run', async () => {
    const { transport, fetchImpl } = sseTransport([
      sseResponse(frames({ event: 'done', data: {} })),
    ])
    await collect(transport)
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>)['Last-Event-ID']).toBeUndefined()
  })

  it('throws a resumable error when the socket closes before a terminal event', async () => {
    const { transport } = sseTransport([
      sseResponse(frames({ event: 'message_delta', data: { text: 'partial' }, id: 'e-9' })),
    ])
    await expect(
      transport.consumeRun({
        turnId: 't1',
        signal: new AbortController().signal,
        onEvent: () => undefined,
      }),
    ).rejects.toBeInstanceOf(StreamInterruptedError)
  })

  it('carries the resume cursor on the interruption', async () => {
    const { transport } = sseTransport([
      sseResponse(frames({ event: 'message_delta', data: { text: 'p' }, id: 'e-9' })),
    ])
    await transport
      .consumeRun({
        turnId: 't1',
        signal: new AbortController().signal,
        onEvent: () => undefined,
      })
      .catch((error: unknown) => {
        expect((error as StreamInterruptedError).lastEventId).toBe('e-9')
      })
  })

  it('falls back to cursor polling when the stream answers with JSON', async () => {
    const { transport } = sseTransport([
      jsonResponse({ detail: 'not a stream' }),
      jsonResponse({ events: [{ event: 'done', id: '1' }], done: true }),
    ])
    const events = await collect(transport)
    expect(events.map((entry) => entry.event.type)).toEqual(['done'])
  })

  it('falls back to cursor polling when the stream route is missing', async () => {
    const { transport } = sseTransport([
      errorResponse(404),
      jsonResponse({ events: [{ event: 'done' }], done: true }),
    ])
    const events = await collect(transport)
    expect(events.map((entry) => entry.event.type)).toEqual(['done'])
  })

  it('propagates a server error that is not a missing route', async () => {
    const { transport } = sseTransport([errorResponse(500, 'boom')])
    await expect(collect(transport)).rejects.toThrow(/status 500/)
  })

  // ml-engine registers no cursor-poll sibling, so the fallback polls the run's own detail route
  // and diffs it the way the agentic transport diffs its resource.
  it('falls back to polling the turn detail the DRF router registers', async () => {
    const { transport, fetchImpl } = sseTransport([
      errorResponse(404),
      jsonResponse({ id: 91, status: 3, response_text: 'partial' }),
      jsonResponse({ id: 91, status: 1, response_text: 'partial answer' }),
    ])
    const events = await collect(transport)
    expect((fetchImpl.mock.calls[1] as [string])[0]).toBe(
      'https://ml.example.com/api/copilot-turn/t1/',
    )
    expect(events.map((entry) => entry.event.type)).toEqual([
      'run_started',
      'message_delta',
      'message_delta',
      'done',
    ])
  })

  it('never asks a run detail to resume from a cursor it does not understand', async () => {
    const { transport, fetchImpl } = sseTransport([
      errorResponse(404),
      jsonResponse({ id: 91, status: 3, response_text: 'a' }),
      jsonResponse({ id: 91, status: 1, response_text: 'ab' }),
    ])
    await collect(transport)
    for (const call of fetchImpl.mock.calls.slice(1)) {
      expect((call as [string])[0]).not.toContain('after=')
    }
  })

  it('advances the poll cursor between rounds', async () => {
    const { transport, fetchImpl } = sseTransport([
      errorResponse(404),
      jsonResponse({ events: [{ event: 'message_delta', text: 'a', id: 'c1' }] }),
      jsonResponse({ events: [{ event: 'done', id: 'c2' }], done: true }),
    ])
    await collect(transport)
    const lastUrl = (fetchImpl.mock.calls[2] as [string, RequestInit])[0]
    expect(lastUrl).toContain('after=c1')
  })

  // ml-engine registers the create on the DRF router as `copilot-turn`, not on the blueprint's
  // /api/copilot/turns/. Pointing at the blueprint is what made `auto` degrade on every first send.
  it('creates a turn against the route the DRF router registers', async () => {
    const { transport, fetchImpl } = sseTransport([
      jsonResponse(
        {
          turn_id: 91,
          conversation_id: 12,
          thread_id: 12,
          request_id: 44,
          sequence: 1,
          status: 0,
          position: 1,
          stream_url: '/api/copilot/turn/91/events',
          replayed: false,
        },
        201,
      ),
    ])
    const created = await transport.createTurn({ prompt: 'hi', threadId: '12' })
    expect(created).toEqual({
      turnId: '91',
      threadId: '12',
      streamUrl: '/api/copilot/turn/91/events',
    })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ml.example.com/api/copilot-turn/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ prompt: 'hi', thread_id: '12' })
  })

  // CopilotAskSerializer declares no scope field, and ml-engine fingerprints the raw body for the
  // idempotency claim, so a scope key would be dropped and would still change that fingerprint.
  it('keeps host scope off the create body, since the serializer has no field for it', async () => {
    const { transport, fetchImpl } = sseTransport([jsonResponse({ turn_id: 'abc' }, 201)])
    await transport.createTurn({ prompt: 'hi', scope: { app: 'viz-ui', organization_id: 7 } })
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body))).toEqual({ prompt: 'hi' })
  })

  it('sends an Idempotency-Key, so a double-click cannot double-spend the credit', async () => {
    const { transport, fetchImpl } = sseTransport([jsonResponse({ turn_id: 'abc' }, 201)])
    await transport.createTurn({ prompt: 'hi' })
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    const key = (init.headers as Record<string, string>)['Idempotency-Key']
    expect(key).toMatch(/^nxcp-/)
    // ml-engine's normalize_key refuses anything longer than this.
    expect((key ?? '').length).toBeLessThanOrEqual(128)
  })

  it('reuses the key the caller minted for this send rather than minting a second one', async () => {
    const { transport, fetchImpl } = sseTransport([
      jsonResponse({ turn_id: 'abc' }, 201),
      jsonResponse({ turn_id: 'abc' }, 200),
    ])
    await transport.createTurn({ prompt: 'hi', idempotencyKey: 'nxcp-pinned' })
    await transport.createTurn({ prompt: 'hi', idempotencyKey: 'nxcp-pinned' })
    for (const call of fetchImpl.mock.calls) {
      const init = (call as [string, RequestInit])[1]
      expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('nxcp-pinned')
    }
  })

  it('reads the turn back through the thread_id ml-engine answers with', async () => {
    const { transport } = sseTransport([
      jsonResponse({ turn_id: 91, conversation_id: 12, thread_id: 12 }, 201),
    ])
    expect(await transport.createTurn({ prompt: 'hi' })).toEqual({
      turnId: '91',
      threadId: '12',
    })
  })

  it('honours a stream_url handed back by create', async () => {
    const { transport, fetchImpl } = sseTransport([
      sseResponse(frames({ event: 'done', data: {} })),
    ])
    await collect(transport, { streamUrl: '/custom/stream/' })
    expect((fetchImpl.mock.calls[0] as [string, RequestInit])[0]).toBe(
      'https://ml.example.com/custom/stream/',
    )
  })

  // Verified against ml-engine service/urls.py + views.py on feat/copilot-w2-memory-and-actions:
  // the DRF router registers `copilot-turn`, and the action url_path is steps/<step_id>/approval.
  it('posts an approval decision to the route ml-engine registers', async () => {
    const { transport, fetchImpl } = sseTransport([jsonResponse({}, 200)])
    await transport.respondToApproval('t1', 's2', true)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ml.example.com/api/copilot-turn/t1/steps/s2/approval/')
    expect(JSON.parse(String(init.body))).toEqual({ approved: true, decision: 'approve' })
  })

  it('posts a rejection the serializer reads the same way', async () => {
    const { transport, fetchImpl } = sseTransport([jsonResponse({}, 200)])
    await transport.respondToApproval('t1', 's2', false)
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body))).toEqual({ approved: false, decision: 'reject' })
  })

  it('cancels through the route the DRF router registers', async () => {
    const { transport, fetchImpl } = sseTransport([jsonResponse({}, 200)])
    await transport.cancelTurn('t1')
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe(
      'https://ml.example.com/api/copilot-turn/t1/cancel/',
    )
  })

  // The SSE route is served by the ASGI path router ahead of Django, at copilot/turn rather than
  // the router's copilot-turn, and without a trailing slash.
  it('tails the stream path ml-engine mounts ahead of Django', async () => {
    const { transport, fetchImpl } = sseTransport([
      sseResponse(frames({ event: 'done', data: {} })),
    ])
    await collect(transport)
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe(
      'https://ml.example.com/api/copilot/turn/t1/events',
    )
  })

  it('lists conversations from the copilot-conversation collection', async () => {
    const { transport, fetchImpl } = sseTransport([
      jsonResponse({
        count: 1,
        results: [
          {
            id: 12,
            title: 'Why is AHU-1 offline?',
            last_activity_at: '2026-08-20T10:00:00Z',
            updated_on: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    ])
    const threads = await transport.listThreads()
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe(
      'https://ml.example.com/api/copilot-conversation/',
    )
    expect(threads).toEqual([
      {
        id: '12',
        title: 'Why is AHU-1 offline?',
        updatedAt: Date.parse('2026-08-20T10:00:00Z'),
      },
    ])
  })

  it('rebuilds a thread from its turn list, artifacts and all', async () => {
    const { transport, fetchImpl } = sseTransport([
      jsonResponse({
        count: 2,
        results: [
          {
            id: 8,
            status: 1,
            prompt_text: 'first',
            response_text: 'one',
            created_on: '2026-08-20T10:00:00Z',
          },
          {
            id: 9,
            status: 1,
            prompt_text: 'second',
            response_text: 'two',
            created_on: '2026-08-20T10:05:00Z',
            tools: ['work_order_retrieve'],
            execution_time: 1.5,
            chart_config: { series: [{ type: 'pie' }] },
            execution_log: [
              {
                tool: 'work_order_retrieve',
                call_id: 'c9',
                output: { columns: ['a'], data: [{ a: 1 }] },
              },
            ],
          },
        ],
      }),
    ])
    const turns = await transport.fetchThread('3')
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe(
      'https://ml.example.com/api/copilot-turn/?conversation=3',
    )
    expect(turns.map((turn) => [turn.prompt, turn.run.text])).toEqual([
      ['first', 'one'],
      ['second', 'two'],
    ])
    expect(turns[1]?.run.tools).toEqual(['work_order_retrieve'])
    expect(turns[1]?.run.executionMs).toBe(1500)
    expect(turns[1]?.run.charts).toHaveLength(1)
    expect(turns[1]?.run.resultData?.rows).toEqual([{ a: 1 }])
  })

  it('accepts an unpaginated turn list too', async () => {
    const { transport } = sseTransport([jsonResponse([{ id: 1, prompt_text: 'x' }])])
    expect(await transport.fetchThread('3')).toHaveLength(1)
  })

  it('treats an unexpected thread payload as an empty history', async () => {
    const { transport } = sseTransport([jsonResponse({ detail: 'nope' })])
    expect(await transport.fetchThread('3')).toEqual([])
  })

  // The dock is mounted on every authenticated route. A cluster whose ml-engine has not shipped
  // the copilot routes yet answers 404 here, and that is "no threads", not a broken surface.
  it('reads an empty thread list from a cluster that serves no thread route', async () => {
    const { transport } = sseTransport([errorResponse(404)])
    expect(await transport.listThreads()).toEqual([])
  })

  it('reads an empty transcript from a cluster that serves no thread route', async () => {
    const { transport } = sseTransport([errorResponse(404)])
    expect(await transport.fetchThread('12')).toEqual([])
  })

  it('still raises a real thread-list failure rather than posing as no history', async () => {
    const { transport } = sseTransport([errorResponse(500, 'boom')])
    await expect(transport.listThreads()).rejects.toThrow(/status 500/)
  })

  it('still raises a real transcript failure rather than posing as no history', async () => {
    const { transport } = sseTransport([errorResponse(500, 'boom')])
    await expect(transport.fetchThread('12')).rejects.toThrow(/status 500/)
  })

  it('swallows a failing cancel, since the run ends server-side anyway', async () => {
    const { transport } = sseTransport([errorResponse(500)])
    await expect(transport.cancelTurn('t1')).resolves.toBeUndefined()
  })
})

describe('AutoTransport', () => {
  it('uses streaming when the route exists', async () => {
    const streaming = new SseTransport({
      baseUrl: 'https://ml.example.com',
      fetchImpl: (async () => jsonResponse({ turn_id: 't1' }, 201)) as never,
    })
    const polling = new AgenticTransport({ baseUrl: 'https://ml.example.com' })
    const auto = new AutoTransport(streaming, polling)
    await auto.createTurn({ prompt: 'x' })
    expect(auto.selected).toBe('sse')
  })

  it('degrades to the agentic contract when the streaming route is absent', async () => {
    const sseFetch = vi.fn(async () => errorResponse(404))
    const agenticFetch = vi.fn(async () => jsonResponse({ id: 12, status: 0 }, 201))
    const auto = new AutoTransport(
      new SseTransport({ baseUrl: 'https://ml.example.com', fetchImpl: sseFetch as never }),
      new AgenticTransport({
        baseUrl: 'https://ml.example.com',
        fetchImpl: agenticFetch as never,
        getIdentity: () => ({ organizationId: 1, userId: 2 }),
      }),
    )
    const created = await auto.createTurn({ prompt: 'x' })
    expect(created.turnId).toBe('12')
    expect(auto.selected).toBe('agentic')
  })

  it('remembers the decision instead of probing on every turn', async () => {
    const sseFetch = vi.fn(async () => errorResponse(404))
    const agenticFetch = vi.fn(async () => jsonResponse({ id: 12, status: 0 }, 201))
    const auto = new AutoTransport(
      new SseTransport({ baseUrl: 'https://ml.example.com', fetchImpl: sseFetch as never }),
      new AgenticTransport({
        baseUrl: 'https://ml.example.com',
        fetchImpl: agenticFetch as never,
        getIdentity: () => ({ organizationId: 1, userId: 2 }),
      }),
    )
    await auto.createTurn({ prompt: 'one' })
    await auto.createTurn({ prompt: 'two' })
    expect(sseFetch).toHaveBeenCalledTimes(1)
    expect(agenticFetch).toHaveBeenCalledTimes(2)
  })

  it('propagates a real failure rather than masking it as a missing route', async () => {
    const auto = new AutoTransport(
      new SseTransport({
        baseUrl: 'https://ml.example.com',
        fetchImpl: (async () => errorResponse(500)) as never,
      }),
      new AgenticTransport({ baseUrl: 'https://ml.example.com' }),
    )
    await expect(auto.createTurn({ prompt: 'x' })).rejects.toThrow(/status 500/)
  })

  // These two are the always-on failure. The create and the stream both degrade on a missing
  // route; the thread reads used to call straight through, so opening the dock's history on a
  // cluster without the copilot routes rejected instead of showing an empty list.
  it('reads an empty thread list when the route is missing, without degrading', async () => {
    const sseFetch = vi.fn(async () => errorResponse(404))
    const agenticFetch = vi.fn(async () => jsonResponse({ results: [] }))
    const auto = new AutoTransport(
      new SseTransport({ baseUrl: 'https://ml.example.com', fetchImpl: sseFetch as never }),
      new AgenticTransport({ baseUrl: 'https://ml.example.com', fetchImpl: agenticFetch as never }),
    )
    expect(await auto.listThreads()).toEqual([])
    // A conversation id is unreadable on the poll contract, so degrading there is never right.
    expect(agenticFetch).not.toHaveBeenCalled()
    expect(auto.selected).toBeUndefined()
  })

  it('reads an empty transcript when the route is missing, without degrading', async () => {
    const sseFetch = vi.fn(async () => errorResponse(404))
    const agenticFetch = vi.fn(async () => jsonResponse({ id: 4, prompt_text: 'earlier' }))
    const auto = new AutoTransport(
      new SseTransport({ baseUrl: 'https://ml.example.com', fetchImpl: sseFetch as never }),
      new AgenticTransport({ baseUrl: 'https://ml.example.com', fetchImpl: agenticFetch as never }),
    )
    expect(await auto.fetchThread('12')).toEqual([])
    expect(agenticFetch).not.toHaveBeenCalled()
    expect(auto.selected).toBeUndefined()
  })

  it('raises a real thread-read failure instead of reporting no history', async () => {
    const auto = new AutoTransport(
      new SseTransport({
        baseUrl: 'https://ml.example.com',
        fetchImpl: (async () => errorResponse(500)) as never,
      }),
      new AgenticTransport({ baseUrl: 'https://ml.example.com' }),
    )
    await expect(auto.listThreads()).rejects.toThrow(/status 500/)
    await expect(auto.fetchThread('12')).rejects.toThrow(/status 500/)
  })

  it('degrades a thread read on a host transport that cannot fetch history', async () => {
    const bare = {
      name: 'sse' as const,
      createTurn: async () => ({ turnId: '1' }),
      consumeRun: async () => undefined,
      cancelTurn: async () => undefined,
      respondToApproval: async () => undefined,
      listThreads: async () => {
        throw new CopilotHttpError(404, '')
      },
    }
    const auto = new AutoTransport(bare, bare)
    expect(await auto.listThreads()).toEqual([])
  })
})

describe('createTransport', () => {
  it('returns the auto transport by default', () => {
    expect(createTransport({ baseUrl: 'https://x' })).toBeInstanceOf(AutoTransport)
  })

  it('honours an explicit pin', () => {
    expect(createTransport({ baseUrl: 'https://x', transport: 'sse' })).toBeInstanceOf(SseTransport)
    expect(createTransport({ baseUrl: 'https://x', transport: 'agentic' })).toBeInstanceOf(
      AgenticTransport,
    )
  })
})
