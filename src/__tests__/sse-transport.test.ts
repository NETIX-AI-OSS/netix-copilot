import { describe, expect, it, vi } from 'vitest'

import { createTransport } from '../transport'
import { AgenticTransport } from '../transport/agentic-transport'
import { AutoTransport } from '../transport/auto-transport'
import { SseTransport } from '../transport/sse-transport'
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

  it('creates a turn against the blueprint route', async () => {
    const { transport, fetchImpl } = sseTransport([
      jsonResponse({ turn_id: 'abc', thread_id: 'th1', stream_url: '/custom/stream' }, 201),
    ])
    const created = await transport.createTurn({ prompt: 'hi', scope: { app: 'viz-ui' } })
    expect(created).toEqual({ turnId: 'abc', threadId: 'th1', streamUrl: '/custom/stream' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ml.example.com/api/copilot/turns/')
    expect(JSON.parse(String(init.body))).toEqual({ prompt: 'hi', scope: { app: 'viz-ui' } })
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

  it('posts an approval decision', async () => {
    const { transport, fetchImpl } = sseTransport([jsonResponse({}, 200)])
    await transport.respondToApproval('t1', 's2', true)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ml.example.com/api/copilot/turns/t1/steps/s2/approval/')
    expect(JSON.parse(String(init.body))).toEqual({ approved: true, decision: 'approve' })
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
