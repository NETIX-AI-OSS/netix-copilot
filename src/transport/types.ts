// The transport contract, over two wire protocols that both speak the copilot event vocabulary in ../types.
// 'sse' is POST /api/copilot-turn/ then GET /api/copilot/turn/{id}/events, the streaming copilot contract.
// 'agentic' is POST /api/agentic-ml-request/ then polling its detail route, the contract the older chat surfaces call.
// 'auto' tries the streaming create once and remembers the answer, corroborating a missing-route
// reply against the contract itself before it settles on the poll contract.

import type { CopilotThread, EnvelopedEvent, RunState, SendTurnInput } from '../types'

export type TransportMode = 'auto' | 'sse' | 'agentic'

export type TransportName = 'sse' | 'agentic'

export interface CreatedTurn {
  turnId: string
  threadId?: string
  streamUrl?: string
  pollUrl?: string
}

export interface ConsumeRunOptions {
  turnId: string
  onEvent: (enveloped: EnvelopedEvent) => void
  signal: AbortSignal
  // Resume cursor. On SSE this becomes the Last-Event-ID header, on polling a query cursor.
  lastEventId?: string
  streamUrl?: string
  pollUrl?: string
  onTransportChange?: (name: TransportName) => void
}

// One turn rebuilt from stored history, in the same shape a live turn ends up in. Replaying a
// thread therefore renders through exactly the same components as a run that just finished,
// including its plan, its charts and its result table.
export interface CopilotTranscriptTurn {
  id: string
  prompt: string
  createdAt: number
  run: RunState
}

export interface CopilotTransport {
  readonly name: TransportName
  createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn>
  // Resolves when a terminal event arrives or the signal aborts.
  consumeRun(options: ConsumeRunOptions): Promise<void>
  cancelTurn(turnId: string): Promise<void>
  respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void>
  listThreads(signal?: AbortSignal): Promise<CopilotThread[]>
  // Optional so a host transport written against v0.1.0 still satisfies the interface. A
  // transport that cannot rebuild history simply omits it and selecting a thread starts empty.
  fetchThread?(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]>
  // Does this cluster serve this transport's contract at all? A capability question, asked of the
  // contract itself, so that giving up on a transport for the life of a tab never rests on how one
  // request happened to fail. Optional for the same reason fetchThread is.
  isDeployed?(signal?: AbortSignal): Promise<boolean>
}

const TERMINAL_EVENTS = new Set(['done', 'error', 'cancelled'])

export function isTerminalEvent(enveloped: EnvelopedEvent): boolean {
  return TERMINAL_EVENTS.has(enveloped.event.type)
}

// Thrown when the stream endpoint exists but did not answer with an SSE body.
export class NotStreamableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotStreamableError'
  }
}

// Thrown when the socket closed before a terminal event, carrying the resume cursor.
export class StreamInterruptedError extends Error {
  readonly lastEventId: string | undefined

  constructor(lastEventId: string | undefined) {
    super('The copilot stream closed before the run finished.')
    this.name = 'StreamInterruptedError'
    this.lastEventId = lastEventId
  }
}

export function fillTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => params[key] ?? match)
}

// One key per user send, so a retry of that send replays on ml-engine instead of spending again.
export function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid !== undefined) return `nxcp-${uuid}`
  return `nxcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
