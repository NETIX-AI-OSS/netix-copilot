import type { AgenticEndpoints, AgenticIdentity } from './agentic-transport';
import type { HttpConfig } from './http';
import type { SseEndpoints } from './sse-transport';
import type { CopilotTransport, TransportMode } from './types';
export interface CopilotTransportConfig extends HttpConfig {
    transport?: TransportMode;
    sseEndpoints?: Partial<SseEndpoints>;
    agenticEndpoints?: Partial<AgenticEndpoints>;
    getIdentity?: () => AgenticIdentity | undefined;
    maxTokens?: number;
    pollIntervalMs?: number;
    maxPollIntervalMs?: number;
    sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
}
export declare function createTransport(config: CopilotTransportConfig): CopilotTransport;
export type { AgenticEndpoints, AgenticIdentity } from './agentic-transport';
export { AGENTIC_STATUS, AgenticTransport, decodeCursor, DEFAULT_AGENTIC_ENDPOINTS, encodeCursor, } from './agentic-transport';
export { AutoTransport } from './auto-transport';
export { decodeFrame, decodePolledEvent } from './decode';
export type { AuthTokenProvider, CopilotFetch, HttpConfig } from './http';
export { CopilotHttpError } from './http';
export type { SseFrame } from './sse';
export { readSseStream, SseParser } from './sse';
export type { SseEndpoints, SseTransportConfig } from './sse-transport';
export { DEFAULT_SSE_ENDPOINTS, SseTransport } from './sse-transport';
export type { ConsumeRunOptions, CopilotTransport, CreatedTurn, TransportMode, TransportName, } from './types';
export { isTerminalEvent, NotStreamableError, StreamInterruptedError } from './types';
