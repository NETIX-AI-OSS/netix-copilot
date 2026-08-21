// The transport contract.
//
// Everything above this line speaks one language: the copilot event vocabulary in ../types.
// Below it there are two very different wire protocols, and which one is live matters:
//
//   'sse'     -- POST /turns/ then GET /turns/{id}/stream, the streaming contract from the
//                copilot blueprint. Verified 2026-08-21: ml-engine does NOT serve this yet.
//   'agentic' -- POST /api/agentic-ml-request/ then poll GET /api/agentic-ml-request/{id}/.
//                This is what ml-engine actually serves today and what every existing chat
//                surface in the fleet already calls. It synthesizes the same event vocabulary
//                from successive snapshots, so the UI layer cannot tell the two apart.
//
// 'auto' probes the streaming route once and remembers the answer.

import type { CopilotThread, EnvelopedEvent, SendTurnInput } from '../types'

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

export interface CopilotTransport {
  readonly name: TransportName
  createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn>
  // Resolves when a terminal event arrives or the signal aborts.
  consumeRun(options: ConsumeRunOptions): Promise<void>
  cancelTurn(turnId: string): Promise<void>
  respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void>
  listThreads(signal?: AbortSignal): Promise<CopilotThread[]>
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
