import type { CopilotThread, SendTurnInput } from '../types';
import type { HttpConfig } from './http';
import type { ConsumeRunOptions, CopilotTranscriptTurn, CopilotTransport, CreatedTurn, TransportName } from './types';
export type { RunCursor, RunSnapshot } from './run-diff';
export { decodeCursor, encodeCursor } from './run-diff';
export { AGENTIC_STATUS } from './transcript';
export interface AgenticEndpoints {
    collection: string;
    detail: string;
    reply: string;
}
export declare const DEFAULT_AGENTIC_ENDPOINTS: AgenticEndpoints;
export interface AgenticIdentity {
    organizationId: number;
    userId: number;
}
export interface AgenticTransportConfig extends HttpConfig {
    endpoints?: Partial<AgenticEndpoints>;
    getIdentity?: () => AgenticIdentity | undefined;
    maxTokens?: number;
    pollIntervalMs?: number;
    maxPollIntervalMs?: number;
    sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
    conversationSurface?: 'web' | 'mobile' | 'embed' | 'api';
}
export declare class AgenticTransport implements CopilotTransport {
    readonly name: TransportName;
    private readonly config;
    private readonly endpoints;
    private readonly sleepImpl;
    constructor(config: AgenticTransportConfig);
    createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn>;
    cancelTurn(): Promise<void>;
    respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void>;
    fetchThread(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]>;
    private readOrEmpty;
    listThreads(signal?: AbortSignal): Promise<CopilotThread[]>;
    consumeRun(options: ConsumeRunOptions): Promise<void>;
}
