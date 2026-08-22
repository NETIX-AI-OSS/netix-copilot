// The streaming transport, re-verified against ml-engine on 2026-08-22.
// Every route below is one ml-engine registers: the DRF router mounts `copilot-turn` and `copilot-conversation`,
// and the SSE tail is served by the ASGI path router in service/mcp_server/asgi.py, ahead of Django and with no trailing slash.

import type { CopilotThread, EnvelopedEvent, JsonObject, SendTurnInput } from '../types'
import { decodeFrame, decodePolledEvent } from './decode'
import type { HttpConfig } from './http'
import {
  buildHeaders,
  CopilotHttpError,
  isRouteMissing,
  joinUrl,
  request,
  requestJson,
} from './http'
import type { RunSnapshot } from './run-diff'
import { decodeCursor, diffRunSnapshot, isTerminalStatus } from './run-diff'
import { readSseStream, SseParser } from './sse'
import type { CopilotRunRow } from './transcript'
import { readRunSummary, turnFromRow } from './transcript'
import type {
  ConsumeRunOptions,
  CopilotTranscriptTurn,
  CopilotTransport,
  CreatedTurn,
  TransportName,
} from './types'
import {
  fillTemplate,
  isTerminalEvent,
  newIdempotencyKey,
  NotStreamableError,
  sleep,
  StreamInterruptedError,
} from './types'

export interface SseEndpoints {
  createTurn: string
  streamTurn: string
  pollTurn: string
  cancelTurn: string
  approval: string
  threads: string
  threadTurns: string
}

// Note the two spellings: the DRF router registers `copilot-turn`, the ASGI SSE route is `copilot/turn`.
export const DEFAULT_SSE_ENDPOINTS: SseEndpoints = {
  createTurn: '/api/copilot-turn/',
  streamTurn: '/api/copilot/turn/{turnId}/events',
  pollTurn: '/api/copilot-turn/{turnId}/',
  cancelTurn: '/api/copilot-turn/{turnId}/cancel/',
  approval: '/api/copilot-turn/{turnId}/steps/{stepId}/approval/',
  threads: '/api/copilot-conversation/',
  threadTurns: '/api/copilot-turn/?conversation={threadId}',
}

export interface SseTransportConfig extends HttpConfig {
  endpoints?: Partial<SseEndpoints>
  pollIntervalMs?: number
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>
}

interface CursorPollResponse {
  events?: unknown[]
  results?: unknown[]
  cursor?: string
  next_cursor?: string
  nextCursor?: string
  done?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value !== '') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

export class SseTransport implements CopilotTransport {
  readonly name: TransportName = 'sse'

  private readonly config: SseTransportConfig
  private readonly endpoints: SseEndpoints
  private readonly sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>

  constructor(config: SseTransportConfig) {
    this.config = config
    this.endpoints = { ...DEFAULT_SSE_ENDPOINTS, ...config.endpoints }
    this.sleepImpl = config.sleepImpl ?? sleep
  }

  // CopilotAskSerializer takes prompt/thread_id and declares no scope field, so page context
  // reaches the model through the prompt itself rather than through a key DRF would drop.
  async createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn> {
    const body: JsonObject = { prompt: input.prompt }
    if (input.threadId !== undefined) body.thread_id = input.threadId
    const payload = await requestJson<unknown>(this.config, this.endpoints.createTurn, {
      method: 'POST',
      body,
      // ml-engine claims this key before it spends anything, so a repeated create replays the run.
      headers: { 'Idempotency-Key': input.idempotencyKey ?? newIdempotencyKey() },
      ...(signal ? { signal } : {}),
    })
    if (!isRecord(payload)) throw new Error('Copilot create-turn returned an unexpected payload.')
    const turnId = readString(payload, ['turn_id', 'turnId', 'id', 'run_id'])
    if (turnId === undefined) throw new Error('Copilot create-turn response carried no turn id.')
    const created: CreatedTurn = { turnId }
    const threadId = readString(payload, ['thread_id', 'threadId'])
    if (threadId !== undefined) created.threadId = threadId
    const streamUrl = readString(payload, ['stream_url', 'streamUrl'])
    if (streamUrl !== undefined) created.streamUrl = streamUrl
    const pollUrl = readString(payload, ['poll_url', 'pollUrl', 'events_url'])
    if (pollUrl !== undefined) created.pollUrl = pollUrl
    return created
  }

  async cancelTurn(turnId: string): Promise<void> {
    await request(this.config, fillTemplate(this.endpoints.cancelTurn, { turnId }), {
      method: 'POST',
    }).catch(() => undefined)
  }

  // ml-engine accepts either key and prefers `approved` when both arrive; sending both keeps the
  // request readable in a log and tolerant of whichever half a proxy strips.
  async respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void> {
    await request(this.config, fillTemplate(this.endpoints.approval, { turnId, stepId }), {
      method: 'POST',
      body: { approved, decision: approved ? 'approve' : 'reject' },
    })
  }

  // A thread's history is its turn list. Every row already carries the plan, the execution log,
  // the chart and the timing, so a replayed turn renders through the same components as a live
  // one instead of degrading to plain text.
  async fetchThread(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]> {
    const path = fillTemplate(this.endpoints.threadTurns, {
      threadId: encodeURIComponent(threadId),
    })
    const payload = await this.readOrEmpty<unknown>(path, signal)
    const rows = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.results)
        ? payload.results
        : []
    return rows.filter(isRecord).map((row, index) => turnFromRow(row, threadId, index))
  }

  async listThreads(signal?: AbortSignal): Promise<CopilotThread[]> {
    const payload = await this.readOrEmpty<unknown>(this.endpoints.threads, signal)
    const rows = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.results)
        ? payload.results
        : []
    return rows.filter(isRecord).map((row) => {
      const updatedRaw = readString(row, [
        'last_activity_at',
        'updated_on',
        'updated_at',
        'updatedAt',
        'created_on',
        'created_at',
      ])
      const parsed = updatedRaw === undefined ? Number.NaN : Date.parse(updatedRaw)
      const thread: CopilotThread = {
        id: readString(row, ['id', 'thread_id', 'threadId']) ?? '',
        title: readString(row, ['title', 'name', 'summary']) ?? 'Untitled',
        updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
      }
      const count = row.message_count ?? row.messageCount ?? row.turn_count
      if (typeof count === 'number') thread.messageCount = count
      return thread
    })
  }

  // A thread read that 404s means this cluster serves no thread store, which is an empty
  // history rather than a failure. The dock is mounted on every route, so it must not throw.
  private async readOrEmpty<T>(path: string, signal?: AbortSignal): Promise<T | undefined> {
    try {
      return await requestJson<T>(this.config, path, { ...(signal ? { signal } : {}) })
    } catch (error) {
      if (isRouteMissing(error)) return undefined
      throw error
    }
  }

  // Whether this cluster serves the copilot contract, asked of a route that takes no arguments and
  // so cannot answer about a resource. A missing route here is the one reply that proves absence;
  // a list, a 401 or a 500 all mean something on the other end is serving these paths.
  async isDeployed(signal?: AbortSignal): Promise<boolean> {
    try {
      await request(this.config, this.endpoints.threads, { ...(signal ? { signal } : {}) })
      return true
    } catch (error) {
      return !isRouteMissing(error)
    }
  }

  async consumeRun(options: ConsumeRunOptions): Promise<void> {
    options.onTransportChange?.('sse')
    try {
      await this.consumeByStreaming(options)
    } catch (error) {
      if (options.signal.aborted) return
      // No stream to tail: the run itself is still readable, so fall back to polling the turn.
      if (isRouteMissing(error)) {
        await this.consumeByCursorPolling(options)
        return
      }
      if (error instanceof NotStreamableError) {
        await this.consumeByCursorPolling(options)
        return
      }
      throw error
    }
  }

  private async consumeByStreaming(options: ConsumeRunOptions): Promise<void> {
    const path =
      options.streamUrl ?? fillTemplate(this.endpoints.streamTurn, { turnId: options.turnId })
    const headers = await buildHeaders(this.config, {
      Accept: 'text/event-stream',
      // Resume rather than replay: the server continues after the last event we actually saw.
      ...(options.lastEventId === undefined ? {} : { 'Last-Event-ID': options.lastEventId }),
    })
    const fetchImpl =
      this.config.fetchImpl ?? ((url: string, init?: RequestInit) => fetch(url, init))
    const response = await fetchImpl(joinUrl(this.config.baseUrl, path), {
      method: 'GET',
      headers,
      signal: options.signal,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new CopilotHttpError(response.status, body)
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('text/event-stream')) {
      throw new NotStreamableError(`Stream endpoint answered with content-type "${contentType}".`)
    }
    if (!response.body) throw new NotStreamableError('Stream endpoint returned no readable body.')

    const parser = new SseParser()
    parser.setLastEventId(options.lastEventId)
    let terminal: EnvelopedEvent | undefined
    await readSseStream(
      response.body,
      (frame) => {
        const decoded = decodeFrame(frame)
        if (!decoded) return
        // The terminal frame is held back, because what it is missing is what the dock shows once
        // the run stops. Everything before it goes out the moment it arrives, as it always did.
        if (isTerminalEvent(decoded)) {
          terminal = decoded
          return
        }
        options.onEvent(decoded)
      },
      { parser, signal: options.signal },
    )
    if (terminal === undefined) {
      if (options.signal.aborted) return
      throw new StreamInterruptedError(parser.getLastEventId())
    }
    options.onEvent(
      options.signal.aborted ? terminal : await this.completeTerminal(terminal, options),
    )
  }

  // ml-engine's `done` frame carries status, turn_id, execution_time, chart_available and
  // response_chars, and its `error` frame carries a code and a detail. Neither carries `tools` or
  // the tool output behind the result table: service/copilot/events.py replaces any event over
  // COPILOT_EVENT_MAX_BYTES with a truncation marker, so a fattened frame would lose the whole run
  // summary rather than part of it. The stored turn keeps both, so it is read once, here, and
  // merged into the terminal event. Nothing above the transport sees a partly-finished run, and
  // the badges and the table appear with the answer instead of only after a thread is re-read.
  private async completeTerminal(
    terminal: EnvelopedEvent,
    options: ConsumeRunOptions,
  ): Promise<EnvelopedEvent> {
    const event = terminal.event
    if (event.type !== 'done' && event.type !== 'error') return terminal
    if (event.tools !== undefined && event.resultData !== undefined) return terminal
    const row = await this.readRunRow(options.turnId, options.signal)
    if (row === undefined) return terminal
    // The wire wins wherever the two agree to disagree; the row only fills what never arrived.
    return { ...terminal, event: { ...readRunSummary(row), ...event } }
  }

  // An enrichment, never a dependency: a run that finished must not fail because this read did.
  private async readRunRow(
    turnId: string,
    signal: AbortSignal,
  ): Promise<CopilotRunRow | undefined> {
    const path = fillTemplate(this.endpoints.pollTurn, { turnId })
    try {
      const payload = await requestJson<unknown>(this.config, path, { signal })
      return isRecord(payload) ? (payload as CopilotRunRow) : undefined
    } catch {
      return undefined
    }
  }

  // ml-engine registers no cursor-poll route: `pollTurn` is the run's own detail, and a poll of it
  // is diffed exactly the way the agentic transport diffs its resource. An event page is still
  // accepted, so a host that points `pollTurn` at one of its own keeps working.
  private async consumeByCursorPolling(options: ConsumeRunOptions): Promise<void> {
    const base =
      options.pollUrl ?? fillTemplate(this.endpoints.pollTurn, { turnId: options.turnId })
    const interval = this.config.pollIntervalMs ?? 1000
    let cursor = options.lastEventId
    const snapshotCursor = decodeCursor(options.lastEventId)
    let snapshotMode = false
    let idleRounds = 0

    while (!options.signal.aborted) {
      // A run detail takes no cursor query; only an event page is asked to resume from one.
      const query =
        cursor === undefined || snapshotMode ? '' : `?after=${encodeURIComponent(cursor)}`
      const payload = await requestJson<CursorPollResponse & RunSnapshot>(
        this.config,
        `${base}${query}`,
        { signal: options.signal },
      )
      const page = payload.events ?? payload.results
      let emitted = 0
      let terminal = false

      if (page === undefined) {
        snapshotMode = true
        for (const enveloped of diffRunSnapshot(payload, snapshotCursor, options.turnId)) {
          emitted += 1
          if (enveloped.id !== undefined) cursor = enveloped.id
          options.onEvent(enveloped)
        }
        if (isTerminalStatus(payload.status)) return
      } else {
        for (const row of page) {
          const decoded = decodePolledEvent(row)
          if (!decoded) continue
          emitted += 1
          if (decoded.id !== undefined) cursor = decoded.id
          if (isTerminalEvent(decoded)) terminal = true
          options.onEvent(decoded)
        }
        cursor = payload.next_cursor ?? payload.nextCursor ?? payload.cursor ?? cursor
        if (terminal || payload.done === true) return
      }

      idleRounds = emitted === 0 ? Math.min(idleRounds + 1, 3) : 0
      await this.sleepImpl(interval * 2 ** idleRounds, options.signal)
    }
  }
}
