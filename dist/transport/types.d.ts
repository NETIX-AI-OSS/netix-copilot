import type { CopilotThread, EnvelopedEvent, RunState, SendTurnInput } from '../types';
export type TransportMode = 'auto' | 'sse' | 'agentic';
export type TransportName = 'sse' | 'agentic';
export interface CreatedTurn {
    turnId: string;
    threadId?: string;
    streamUrl?: string;
    pollUrl?: string;
}
export interface ConsumeRunOptions {
    turnId: string;
    onEvent: (enveloped: EnvelopedEvent) => void;
    signal: AbortSignal;
    lastEventId?: string;
    streamUrl?: string;
    pollUrl?: string;
    onTransportChange?: (name: TransportName) => void;
}
export interface CopilotTranscriptTurn {
    id: string;
    prompt: string;
    createdAt: number;
    run: RunState;
}
export interface CopilotTransport {
    readonly name: TransportName;
    createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn>;
    consumeRun(options: ConsumeRunOptions): Promise<void>;
    cancelTurn(turnId: string): Promise<void>;
    respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void>;
    listThreads(signal?: AbortSignal): Promise<CopilotThread[]>;
    fetchThread?(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]>;
}
export declare function isTerminalEvent(enveloped: EnvelopedEvent): boolean;
export declare class NotStreamableError extends Error {
    constructor(message: string);
}
export declare class StreamInterruptedError extends Error {
    readonly lastEventId: string | undefined;
    constructor(lastEventId: string | undefined);
}
export declare function fillTemplate(template: string, params: Record<string, string>): string;
export declare function sleep(ms: number, signal?: AbortSignal): Promise<void>;
