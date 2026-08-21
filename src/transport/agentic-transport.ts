// The transport that works against production today.
//
// ml-engine exposes an asynchronous request resource, not a stream:
//   POST /api/agentic-ml-request/         -> 201 { id, status: 0, turn_id, conversation_id }
//   GET  /api/agentic-ml-request/{id}/    -> the whole run so far, polled
//   POST /api/agentic-ml-request/{id}/reply/ -> 202, no body, 409 unless COMPLETED or ERRORED
//
// This class polls that resource and diffs successive snapshots into the same event vocabulary
// the streaming contract emits, so nothing above the transport layer changes when SSE lands.

import type { CopilotThread, EnvelopedEvent, JsonObject, SendTurnInput } from '../types'
import type { HttpConfig } from './http'
import { request, requestJson } from './http'
import type { CopilotRunRow } from './transcript'
import {
  AGENTIC_STATUS,
  logStep,
  mapUsage,
  planSteps,
  readRunSummary,
  transcriptFromRequest,
} from './transcript'
import type {
  ConsumeRunOptions,
  CopilotTranscriptTurn,
  CopilotTransport,
  CreatedTurn,
  TransportName,
} from './types'
import { fillTemplate, sleep } from './types'

export { AGENTIC_STATUS } from './transcript'

export interface AgenticEndpoints {
  collection: string
  detail: string
  reply: string
}

export const DEFAULT_AGENTIC_ENDPOINTS: AgenticEndpoints = {
  collection: '/api/agentic-ml-request/',
  detail: '/api/agentic-ml-request/{turnId}/',
  reply: '/api/agentic-ml-request/{turnId}/reply/',
}

export interface AgenticIdentity {
  organizationId: number
  userId: number
}

export interface AgenticTransportConfig extends HttpConfig {
  endpoints?: Partial<AgenticEndpoints>
  // The live create endpoint takes org and user in the body rather than deriving them from the
  // token. That is a backend trust bug, tracked in the copilot blueprint; until it is fixed the
  // SDK has to send what the host tells it.
  getIdentity?: () => AgenticIdentity | undefined
  maxTokens?: number
  pollIntervalMs?: number
  maxPollIntervalMs?: number
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>
}

// The poll resource, plus the two ids that point at the copilot-turn row behind it.
interface AgenticSnapshot extends CopilotRunRow {
  turn_id?: number | string | null
  conversation_id?: number | string | null
}

// The resume cursor for this transport. It has to describe how much of the snapshot the client
// has already turned into events, because every poll returns the whole run from the beginning.
interface AgenticCursor {
  textLength: number
  logCount: number
  planEmitted: boolean
  chartEmitted: boolean
  usageSignature: string
  runStarted: boolean
  queuedEmitted: boolean
}

const CURSOR_PREFIX = 'agentic'

export function encodeCursor(cursor: AgenticCursor): string {
  const flags =
    (cursor.planEmitted ? 'p' : '-') +
    (cursor.chartEmitted ? 'c' : '-') +
    (cursor.runStarted ? 'r' : '-') +
    (cursor.queuedEmitted ? 'q' : '-')
  return [
    CURSOR_PREFIX,
    cursor.textLength,
    cursor.logCount,
    flags,
    encodeURIComponent(cursor.usageSignature),
  ].join(':')
}

export function decodeCursor(raw: string | undefined): AgenticCursor {
  const empty: AgenticCursor = {
    textLength: 0,
    logCount: 0,
    planEmitted: false,
    chartEmitted: false,
    usageSignature: '',
    runStarted: false,
    queuedEmitted: false,
  }
  if (raw === undefined) return empty
  const parts = raw.split(':')
  if (parts[0] !== CURSOR_PREFIX || parts.length < 4) return empty
  const textLength = Number(parts[1])
  const logCount = Number(parts[2])
  const flags = parts[3] ?? ''
  return {
    textLength: Number.isFinite(textLength) ? textLength : 0,
    logCount: Number.isFinite(logCount) ? logCount : 0,
    planEmitted: flags.includes('p'),
    chartEmitted: flags.includes('c'),
    runStarted: flags.includes('r'),
    queuedEmitted: flags.includes('q'),
    usageSignature: decodeURIComponent(parts[4] ?? ''),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let index = 0
  while (index < limit && a.charCodeAt(index) === b.charCodeAt(index)) index += 1
  return index
}

function usageSignature(usage: Record<string, unknown> | null | undefined): string {
  if (!usage) return ''
  return JSON.stringify(usage)
}

export class AgenticTransport implements CopilotTransport {
  readonly name: TransportName = 'agentic'

  private readonly config: AgenticTransportConfig
  private readonly endpoints: AgenticEndpoints
  private readonly sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>

  constructor(config: AgenticTransportConfig) {
    this.config = config
    this.endpoints = { ...DEFAULT_AGENTIC_ENDPOINTS, ...config.endpoints }
    this.sleepImpl = config.sleepImpl ?? sleep
  }

  async createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn> {
    // In this contract a thread and a turn are the same row: follow-ups POST to /reply/.
    if (input.threadId !== undefined && input.threadId !== '') {
      await request(this.config, fillTemplate(this.endpoints.reply, { turnId: input.threadId }), {
        method: 'POST',
        body: { message: input.prompt },
        ...(signal ? { signal } : {}),
      })
      return { turnId: input.threadId, threadId: input.threadId }
    }

    const identity = this.config.getIdentity?.()
    const scope = input.scope ?? {}
    const organizationId = identity?.organizationId ?? readNumber(scope, 'organization_id')
    const userId = identity?.userId ?? readNumber(scope, 'user_id')
    if (organizationId === undefined || userId === undefined) {
      throw new Error(
        'netix-copilot: the agentic transport needs organizationId and userId. Supply them from ' +
          'the host page context or via getIdentity.',
      )
    }
    const body: JsonObject = {
      organization_id: organizationId,
      user_id: userId,
      prompt_text: input.prompt,
    }
    if (this.config.maxTokens !== undefined) body.max_tokens = this.config.maxTokens

    const payload = await requestJson<AgenticSnapshot>(this.config, this.endpoints.collection, {
      method: 'POST',
      body,
      // Idempotency-Key makes a retried create replay rather than start a second run.
      headers: { 'Idempotency-Key': buildIdempotencyKey(organizationId, userId, input.prompt) },
      ...(signal ? { signal } : {}),
    })
    const turnId = payload.id === undefined ? undefined : String(payload.id)
    if (turnId === undefined) throw new Error('ml-engine create returned no request id.')
    return { turnId, threadId: turnId }
  }

  // The live contract has no cancel route. Aborting the local reader is all the client can do,
  // and the run finishes server-side regardless.
  async cancelTurn(): Promise<void> {
    return Promise.resolve()
  }

  // The poll resource surfaces no awaiting_approval step and serves no decision route, so there
  // is nothing to record against. Failing loudly is deliberate: resolving quietly would tell the
  // user a destructive action was authorised when nothing recorded it.
  async respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void> {
    throw new Error(
      'netix-copilot: approvals need the streaming copilot contract. The agentic poll contract ' +
        `cannot record ${approved ? 'approval' : 'rejection'} of step ${stepId} on turn ${turnId}.`,
    )
  }

  // The thread and the turn are the same row here, so a transcript is one GET of the request
  // resource, rebuilt into the turns the message view already knows how to render.
  async fetchThread(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]> {
    const path = fillTemplate(this.endpoints.detail, { turnId: encodeURIComponent(threadId) })
    const snapshot = await requestJson<AgenticSnapshot>(this.config, path, {
      ...(signal ? { signal } : {}),
    })
    return transcriptFromRequest(snapshot, threadId)
  }

  async listThreads(signal?: AbortSignal): Promise<CopilotThread[]> {
    const payload = await requestJson<unknown>(this.config, this.endpoints.collection, {
      ...(signal ? { signal } : {}),
    })
    const rows = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.results)
        ? payload.results
        : []
    return rows.filter(isRecord).map((row) => {
      const id = row.id === undefined ? '' : String(row.id)
      const prompt = typeof row.prompt_text === 'string' ? row.prompt_text : ''
      const updatedRaw = typeof row.updated_on === 'string' ? row.updated_on : undefined
      const parsed = updatedRaw === undefined ? Number.NaN : Date.parse(updatedRaw)
      return {
        id,
        title: prompt === '' ? `Request ${id}` : truncate(prompt, 60),
        updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
      }
    })
  }

  async consumeRun(options: ConsumeRunOptions): Promise<void> {
    options.onTransportChange?.('agentic')
    const path = fillTemplate(this.endpoints.detail, { turnId: options.turnId })
    const base = this.config.pollIntervalMs ?? 2000
    const ceiling = this.config.maxPollIntervalMs ?? 10000
    const cursor = decodeCursor(options.lastEventId)
    let idleRounds = 0

    while (!options.signal.aborted) {
      const snapshot = await requestJson<AgenticSnapshot>(this.config, path, {
        signal: options.signal,
      })
      const events = this.diff(snapshot, cursor, options.turnId)
      for (const enveloped of events) options.onEvent(enveloped)
      if (isTerminalStatus(snapshot.status)) return
      idleRounds = events.length === 0 ? Math.min(idleRounds + 1, 3) : 0
      await this.sleepImpl(Math.min(base * 2 ** idleRounds, ceiling), options.signal)
    }
  }

  // Turn one snapshot into the events it implies, advancing the cursor in place.
  private diff(snapshot: AgenticSnapshot, cursor: AgenticCursor, turnId: string): EnvelopedEvent[] {
    const events: EnvelopedEvent[] = []
    const emit = (event: EnvelopedEvent['event']): void => {
      events.push({ event, id: encodeCursor(cursor) })
    }

    if (!cursor.runStarted) {
      cursor.runStarted = true
      emit({ type: 'run_started', turnId })
    }

    if (snapshot.status === AGENTIC_STATUS.PENDING && !cursor.queuedEmitted) {
      cursor.queuedEmitted = true
      emit({ type: 'queued' })
    }

    const plan = Array.isArray(snapshot.plan) ? snapshot.plan : []
    if (!cursor.planEmitted && plan.length > 0) {
      cursor.planEmitted = true
      emit({ type: 'plan', steps: planSteps(plan) })
    }

    const log = Array.isArray(snapshot.execution_log) ? snapshot.execution_log : []
    for (let index = cursor.logCount; index < log.length; index += 1) {
      const entry = log[index]
      if (!isRecord(entry)) continue
      // Polling only ever sees finished tool calls, so the timeline gets the completed form.
      emit({ type: 'step_result', step: logStep(entry, index) })
    }
    cursor.logCount = log.length

    const text = typeof snapshot.response_text === 'string' ? snapshot.response_text : ''
    if (text.length > cursor.textLength) {
      // The snapshot carries the whole answer every time, so send only what is new. A rewritten
      // answer falls back to the common prefix, which is the closest an append-only feed allows.
      const seen = text.slice(0, cursor.textLength)
      const from =
        seen === text.slice(0, seen.length) ? cursor.textLength : commonPrefixLength(seen, text)
      cursor.textLength = text.length
      emit({ type: 'message_delta', text: text.slice(from) })
    }

    if (
      !cursor.chartEmitted &&
      snapshot.chart_available === true &&
      isRecord(snapshot.chart_config)
    ) {
      if (Object.keys(snapshot.chart_config).length > 0) {
        cursor.chartEmitted = true
        emit({ type: 'chart', option: snapshot.chart_config as JsonObject })
      }
    }

    const signature = usageSignature(snapshot.usage)
    if (signature !== '' && signature !== cursor.usageSignature) {
      cursor.usageSignature = signature
      emit({ type: 'usage', usage: mapUsage(snapshot.usage) })
    }

    // The summary rides on the terminal event because the whole snapshot is final by then, and
    // because the decoder accepts eleven event names and would drop a twelfth without a word.
    const summary = readRunSummary(snapshot)
    if (snapshot.status === AGENTIC_STATUS.COMPLETED) emit({ type: 'done', turnId, ...summary })
    else if (snapshot.status === AGENTIC_STATUS.ERRORED) {
      emit({
        type: 'error',
        error: { message: snapshot.error ?? 'The copilot run failed.' },
        ...summary,
      })
    } else if (snapshot.status === AGENTIC_STATUS.CANCELLED) emit({ type: 'cancelled' })

    return events
  }
}

function isTerminalStatus(status: number | undefined): boolean {
  return (
    status === AGENTIC_STATUS.COMPLETED ||
    status === AGENTIC_STATUS.ERRORED ||
    status === AGENTIC_STATUS.CANCELLED
  )
}

function readNumber(scope: Record<string, unknown>, key: string): number | undefined {
  const value = scope[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return undefined
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

// A stable key for one prompt from one user, so a retried create replays instead of re-running.
function buildIdempotencyKey(organizationId: number, userId: number, prompt: string): string {
  let hash = 5381
  for (let index = 0; index < prompt.length; index += 1) {
    hash = ((hash << 5) + hash + prompt.charCodeAt(index)) >>> 0
  }
  return `nxcp-${organizationId}-${userId}-${hash.toString(36)}-${Date.now().toString(36)}`
}
