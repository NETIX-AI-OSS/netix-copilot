import type { AgenticEndpoints, AgenticIdentity } from './agentic-transport'
import { AgenticTransport } from './agentic-transport'
import { AutoTransport } from './auto-transport'
import type { HttpConfig } from './http'
import type { SseEndpoints } from './sse-transport'
import { SseTransport } from './sse-transport'
import type { CopilotTransport, TransportMode } from './types'

export interface CopilotTransportConfig extends HttpConfig {
  // Defaults to 'auto'. Pin it to 'agentic' to skip the streaming probe entirely.
  transport?: TransportMode
  sseEndpoints?: Partial<SseEndpoints>
  agenticEndpoints?: Partial<AgenticEndpoints>
  getIdentity?: () => AgenticIdentity | undefined
  maxTokens?: number
  pollIntervalMs?: number
  maxPollIntervalMs?: number
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>
}

export function createTransport(config: CopilotTransportConfig): CopilotTransport {
  const http: HttpConfig = {
    baseUrl: config.baseUrl,
    ...(config.getAuthToken ? { getAuthToken: config.getAuthToken } : {}),
    ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    ...(config.headers ? { headers: config.headers } : {}),
  }
  const streaming = new SseTransport({
    ...http,
    ...(config.sseEndpoints ? { endpoints: config.sseEndpoints } : {}),
    ...(config.pollIntervalMs === undefined ? {} : { pollIntervalMs: config.pollIntervalMs }),
    ...(config.sleepImpl ? { sleepImpl: config.sleepImpl } : {}),
  })
  const polling = new AgenticTransport({
    ...http,
    ...(config.agenticEndpoints ? { endpoints: config.agenticEndpoints } : {}),
    ...(config.getIdentity ? { getIdentity: config.getIdentity } : {}),
    ...(config.maxTokens === undefined ? {} : { maxTokens: config.maxTokens }),
    ...(config.pollIntervalMs === undefined ? {} : { pollIntervalMs: config.pollIntervalMs }),
    ...(config.maxPollIntervalMs === undefined
      ? {}
      : { maxPollIntervalMs: config.maxPollIntervalMs }),
    ...(config.sleepImpl ? { sleepImpl: config.sleepImpl } : {}),
  })

  switch (config.transport ?? 'auto') {
    case 'sse':
      return streaming
    case 'agentic':
      return polling
    default:
      return new AutoTransport(streaming, polling)
  }
}

export type { AgenticEndpoints, AgenticIdentity } from './agentic-transport'
export { AGENTIC_STATUS, AgenticTransport, DEFAULT_AGENTIC_ENDPOINTS } from './agentic-transport'
export { AutoTransport } from './auto-transport'
export { decodeFrame, decodePolledEvent } from './decode'
export type { AuthTokenProvider, CopilotFetch, HttpConfig } from './http'
export { CopilotHttpError } from './http'
export { formatResultCell, normalizeResultData } from './result-data'
export type { RunCursor, RunSnapshot } from './run-diff'
export { decodeCursor, diffRunSnapshot, encodeCursor, isTerminalStatus } from './run-diff'
export type { SseFrame } from './sse'
export { readSseStream, SseParser } from './sse'
export type { SseEndpoints, SseTransportConfig } from './sse-transport'
export { DEFAULT_SSE_ENDPOINTS, SseTransport } from './sse-transport'
export type { CopilotRunRow } from './transcript'
export { transcriptFromRequest, turnFromRow } from './transcript'
export type {
  ConsumeRunOptions,
  CopilotTranscriptTurn,
  CopilotTransport,
  CreatedTurn,
  TransportMode,
  TransportName,
} from './types'
export {
  isTerminalEvent,
  newIdempotencyKey,
  NotStreamableError,
  StreamInterruptedError,
} from './types'
