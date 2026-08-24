// The transport for ml-engine's asynchronous request resource, the contract every existing chat surface calls.
// POST /api/agentic-ml-request/ opens a run, GET /api/agentic-ml-request/{id}/ is polled, /reply/ continues it.
// Successive snapshots are diffed into the same event vocabulary the stream emits, so nothing above this layer changes.

import type { CopilotThread, JsonObject, SendTurnInput } from '../types'
import type { HttpConfig } from './http'
import { isRouteMissing, request, requestJson } from './http'
import type { RunSnapshot } from './run-diff'
import { decodeCursor, diffRunSnapshot, isTerminalStatus } from './run-diff'
import { transcriptFromRequest } from './transcript'
import type {
  ConsumeRunOptions,
  CopilotTranscriptTurn,
  CopilotTransport,
  CreatedTurn,
  TransportName,
} from './types'
import { fillTemplate, newIdempotencyKey, sleep } from './types'

export type { RunCursor, RunSnapshot } from './run-diff'
export { decodeCursor, encodeCursor } from './run-diff'
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
  conversationSurface?: 'web' | 'mobile' | 'embed' | 'api'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
        body: { message: input.prompt, model_tier: input.modelTier ?? 'base' },
        headers: { 'Idempotency-Key': input.idempotencyKey ?? newIdempotencyKey() },
        ...(signal ? { signal } : {}),
      })
      return { turnId: input.threadId, threadId: input.threadId, modelTier: input.modelTier }
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
      model_tier: input.modelTier ?? 'base',
      conversation_surface: input.surface ?? 'web',
    }
    if (this.config.maxTokens !== undefined) body.max_tokens = this.config.maxTokens

    const payload = await requestJson<RunSnapshot>(this.config, this.endpoints.collection, {
      method: 'POST',
      body,
      // Idempotency-Key makes a retried create replay rather than start a second run.
      headers: { 'Idempotency-Key': input.idempotencyKey ?? newIdempotencyKey() },
      ...(signal ? { signal } : {}),
    })
    const turnId = payload.id === undefined ? undefined : String(payload.id)
    if (turnId === undefined) throw new Error('ml-engine create returned no request id.')
    return { turnId, threadId: turnId, modelTier: input.modelTier }
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
    const snapshot = await this.readOrEmpty<RunSnapshot>(path, signal)
    if (snapshot === undefined) return []
    return transcriptFromRequest(snapshot, threadId)
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

  async listThreads(signal?: AbortSignal): Promise<CopilotThread[]> {
    const payload = await this.readOrEmpty<unknown>(this.endpoints.collection, signal)
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
      const snapshot = await requestJson<RunSnapshot>(this.config, path, {
        signal: options.signal,
      })
      const events = diffRunSnapshot(snapshot, cursor, options.turnId)
      for (const enveloped of events) options.onEvent(enveloped)
      if (isTerminalStatus(snapshot.status)) return
      idleRounds = events.length === 0 ? Math.min(idleRounds + 1, 3) : 0
      await this.sleepImpl(Math.min(base * 2 ** idleRounds, ceiling), options.signal)
    }
  }
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
