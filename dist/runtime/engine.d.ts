import type { CopilotTransport, ThreadPatch, TransportName } from '../transport/types';
import type { CopilotThread, JsonObject, ModelTier, RunState } from '../types';
export interface CopilotTurnView {
    id: string;
    prompt: string;
    createdAt: number;
    run: RunState;
    wirePrompt?: string;
}
export interface CopilotSendOptions {
    wireText?: string;
}
export interface CopilotEngineState {
    threadId?: string;
    turns: CopilotTurnView[];
    transport?: TransportName;
    sending: boolean;
    online: boolean;
    threads: CopilotThread[];
    threadsLoaded: boolean;
    threadLoading: boolean;
    modelTier: ModelTier;
    modelTierLocked: boolean;
    contextEnabled: boolean;
}
export interface OnlineSource {
    isOnline(): boolean;
    subscribe(listener: (online: boolean) => void): () => void;
}
export interface CopilotLogger {
    warn(message: string, detail?: unknown): void;
    error(message: string, detail?: unknown): void;
}
export interface CopilotEngineOptions {
    transport: CopilotTransport;
    teardownGraceMs?: number;
    maxResumeAttempts?: number;
    resumeDelayMs?: number;
    onlineSource?: OnlineSource;
    logger?: CopilotLogger;
    now?: () => number;
    setTimeoutImpl?: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimeoutImpl?: (handle: ReturnType<typeof setTimeout>) => void;
    conversationSurface?: 'web' | 'mobile' | 'embed' | 'api';
}
export declare function browserOnlineSource(): OnlineSource;
export declare class CopilotEngine {
    private readonly options;
    private readonly listeners;
    private readonly now;
    private readonly schedule;
    private readonly unschedule;
    private snapshot;
    private controller;
    private refCount;
    private teardownHandle;
    private unsubscribeOnline;
    private disposed;
    private localTurnSeq;
    private threadSeq;
    private activeStreamUrl;
    private activePollUrl;
    constructor(options: CopilotEngineOptions);
    subscribe: (listener: () => void) => (() => void);
    getSnapshot: () => CopilotEngineState;
    retain(): void;
    release(): void;
    get activeRun(): RunState | undefined;
    get isStreaming(): boolean;
    send(prompt: string, scope?: JsonObject, options?: CopilotSendOptions): Promise<void>;
    cancel(): void;
    approve(stepId: string, approved: boolean): Promise<void>;
    startNewThread(): void;
    selectThread(threadId: string): void;
    loadThread(threadId: string): Promise<void>;
    loadThreads(): Promise<void>;
    setModelTier(tier: ModelTier): void;
    setContextEnabled(enabled: boolean): void;
    updateThread(threadId: string, patch: ThreadPatch): Promise<void>;
    deleteThread(threadId: string): Promise<void>;
    dispose(): void;
    private consume;
    private handleConnectivity;
    private abortActiveRun;
    private forgetRunUrls;
    private delay;
    private pushEnveloped;
    private pushEvent;
    private patchActiveRun;
    private update;
    private notify;
}
