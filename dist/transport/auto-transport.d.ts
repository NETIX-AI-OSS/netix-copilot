import type { CopilotThread, SendTurnInput } from '../types';
import type { ConsumeRunOptions, CopilotTranscriptTurn, CopilotTransport, CreatedTurn, ThreadPatch, TransportName } from './types';
export declare class AutoTransport implements CopilotTransport {
    private readonly streaming;
    private readonly polling;
    private resolved;
    constructor(streaming: CopilotTransport, polling: CopilotTransport);
    get name(): TransportName;
    get selected(): TransportName | undefined;
    createTurn(input: SendTurnInput, signal?: AbortSignal): Promise<CreatedTurn>;
    consumeRun(options: ConsumeRunOptions): Promise<void>;
    cancelTurn(turnId: string): Promise<void>;
    respondToApproval(turnId: string, stepId: string, approved: boolean): Promise<void>;
    listThreads(signal?: AbortSignal): Promise<CopilotThread[]>;
    fetchThread(threadId: string, signal?: AbortSignal): Promise<CopilotTranscriptTurn[]>;
    updateThread(threadId: string, patch: ThreadPatch, signal?: AbortSignal): Promise<CopilotThread>;
    deleteThread(threadId: string, signal?: AbortSignal): Promise<void>;
    private streamingIsAbsent;
}
