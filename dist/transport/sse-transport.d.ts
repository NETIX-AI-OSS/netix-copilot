import type { CopilotThread, SendTurnInput } from '../types';
import type { HttpConfig } from './http';
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn, TransportName } from './types';
export interface SseEndpoints {
    createTurn: string;
    streamTurn: string;
    pollTurn: string;
    cancelTurn: string;
    approval: string;
    threads: string;
}
export declare const DEFAULT_SSE_ENDPOINTS: SseEndpoints;
export interface SseTransportConfig extends HttpConfig {
    endpoints?: Partial<SseEndpoints>;
    pollIntervalMs?: number;
    sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
}
export declare class SseTransport implements CopilotTransport {
    readonly name: TransportName;
    private readonly config;
    private readonly endpoints;
    private readonly sleepImpl;
    constructor(config: SseTransportConfig);
    createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn>;
    cancelTurn(turnId: string): Promise<void>;
    respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void>;
    listThreads(signal?: AbortSignal): Promise<CopilotThread[]>;
    consumeRun(options: ConsumeRunOptions): Promise<void>;
    private consumeByStreaming;
    private consumeByCursorPolling;
}
