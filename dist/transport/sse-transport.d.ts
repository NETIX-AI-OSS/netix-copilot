import type { CopilotThread, SendTurnInput } from '../types';
import type { HttpConfig } from './http';
import type { ConsumeRunOptions, CopilotTranscriptTurn, CopilotTransport, CreatedTurn, TransportName } from './types';
export interface SseEndpoints {
    createTurn: string;
    streamTurn: string;
    pollTurn: string;
    cancelTurn: string;
    approval: string;
    threads: string;
    threadTurns: string;
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
    fetchThread(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]>;
    listThreads(signal?: AbortSignal): Promise<CopilotThread[]>;
    private readOrEmpty;
    isDeployed(signal?: AbortSignal): Promise<boolean>;
    consumeRun(options: ConsumeRunOptions): Promise<void>;
    private consumeByStreaming;
    private completeTerminal;
    private readRunRow;
    private consumeByCursorPolling;
}
