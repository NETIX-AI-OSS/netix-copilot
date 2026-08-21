import type { CopilotThread, SendTurnInput } from '../types';
import type { HttpConfig } from './http';
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn, TransportName } from './types';
export declare const AGENTIC_STATUS: {
    readonly PENDING: 0;
    readonly COMPLETED: 1;
    readonly ERRORED: 2;
    readonly PROCESSING: 3;
    readonly CANCELLED: 4;
};
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
}
interface AgenticCursor {
    textLength: number;
    logCount: number;
    planEmitted: boolean;
    chartEmitted: boolean;
    usageSignature: string;
    runStarted: boolean;
    queuedEmitted: boolean;
}
export declare function encodeCursor(cursor: AgenticCursor): string;
export declare function decodeCursor(raw: string | undefined): AgenticCursor;
export declare class AgenticTransport implements CopilotTransport {
    readonly name: TransportName;
    private readonly config;
    private readonly endpoints;
    private readonly sleepImpl;
    constructor(config: AgenticTransportConfig);
    createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn>;
    cancelTurn(): Promise<void>;
    respondToApproval(): Promise<void>;
    listThreads(signal?: AbortSignal): Promise<CopilotThread[]>;
    consumeRun(options: ConsumeRunOptions): Promise<void>;
    private diff;
}
export {};
