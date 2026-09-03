export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
export type JsonObject = {
    [key: string]: JsonValue;
};
export type ModelTier = 'base' | 'high' | 'max';
export interface ModelTierMetadata {
    key: ModelTier;
    label: string;
    multiplier: 1 | 5 | 20;
}
export declare const MODEL_TIERS: readonly ModelTierMetadata[];
export declare function modelTierMetadata(tier: ModelTier): ModelTierMetadata;
export declare const COPILOT_EVENT_NAMES: readonly ["run_started", "queued", "plan", "agent_started", "agent_finished", "step_started", "step_result", "message_delta", "chart", "usage", "done", "error", "cancelled"];
export type CopilotEventName = (typeof COPILOT_EVENT_NAMES)[number];
export type StepStatus = 'pending' | 'running' | 'ok' | 'error' | 'skipped' | 'awaiting_approval' | 'rejected' | 'cancelled';
export type StepKind = 'tool' | 'agent' | 'plan';
export type RunRoute = 'direct' | 'orchestrator';
export interface PlanStep {
    id: string;
    title: string;
    tool?: string;
    status: StepStatus;
    kind?: StepKind;
    argsSummary?: string;
    durationMs?: number;
    detail?: string;
    agent?: string;
    parentId?: string;
    depth?: number;
    startedAt?: number;
    finishedAt?: number;
    task?: string;
    feedback?: string;
    expiresAt?: number;
    output?: JsonValue;
}
export interface RunPlan {
    reasoning?: string;
    lines: string[];
}
export interface CopilotUsage {
    creditsUsed?: number;
    creditsRemaining?: number;
    tokensIn?: number;
    tokensOut?: number;
    calls?: number;
    costUsd?: number;
    model?: string;
}
export interface CopilotResultData {
    columns: string[];
    rows: JsonObject[];
    raw: JsonValue;
}
export interface CopilotRunSummary {
    tools?: string[];
    executionMs?: number;
    resultData?: CopilotResultData;
    steps?: PlanStep[];
    plan?: RunPlan;
}
export type CopilotErrorCause = 'budget' | 'tool_error' | 'provider' | 'internal';
export interface CopilotErrorPayload {
    message: string;
    code?: string;
    cause?: CopilotErrorCause;
    retryable?: boolean;
}
export interface RunStartedEvent {
    type: 'run_started';
    turnId: string;
    model?: string;
    modelTier?: ModelTier;
    creditsRemaining?: number;
    route?: RunRoute;
    agent?: string;
    startedAt?: number;
}
export interface QueuedEvent {
    type: 'queued';
    position?: number;
}
export interface PlanEvent {
    type: 'plan';
    steps: PlanStep[];
    lines?: string[];
    reasoning?: string;
}
export interface AgentStartedEvent {
    type: 'agent_started';
    agent: string;
    callId: string;
    parentId?: string;
    task?: string;
    feedback?: string;
    startedAt?: number;
}
export interface AgentFinishedEvent {
    type: 'agent_finished';
    agent: string;
    callId: string;
    status: 'ok' | 'error';
    durationMs?: number;
    toolsUsed?: string[];
    responseChars?: number;
    chartAvailable?: boolean;
    finishedAt?: number;
}
export interface StepStartedEvent {
    type: 'step_started';
    step: PlanStep;
}
export interface StepResultEvent {
    type: 'step_result';
    step: PlanStep;
}
export interface MessageDeltaEvent {
    type: 'message_delta';
    text: string;
}
export interface ChartEvent {
    type: 'chart';
    option: JsonObject;
    title?: string;
    chartId?: string;
}
export interface UsageEvent {
    type: 'usage';
    usage: CopilotUsage;
}
export interface DoneEvent extends CopilotRunSummary {
    type: 'done';
    turnId?: string;
}
export interface ErrorEvent extends CopilotRunSummary {
    type: 'error';
    error: CopilotErrorPayload;
}
export interface CancelledEvent {
    type: 'cancelled';
    reason?: string;
}
export type CopilotEvent = RunStartedEvent | QueuedEvent | PlanEvent | AgentStartedEvent | AgentFinishedEvent | StepStartedEvent | StepResultEvent | MessageDeltaEvent | ChartEvent | UsageEvent | DoneEvent | ErrorEvent | CancelledEvent;
export interface EnvelopedEvent {
    event: CopilotEvent;
    id?: string;
}
export type RunStatus = 'idle' | 'creating' | 'queued' | 'streaming' | 'paused' | 'done' | 'error' | 'cancelled';
export interface CopilotChart {
    id: string;
    option: JsonObject;
    title?: string;
}
export interface CopilotMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    createdAt: number;
    charts?: CopilotChart[];
    error?: CopilotErrorPayload;
}
export interface CopilotThread {
    id: string;
    title: string;
    updatedAt: number;
    messageCount?: number;
    modelTier?: ModelTier;
    isPinned?: boolean;
    surface?: string;
    createdAt?: number;
}
export interface RunState {
    status: RunStatus;
    turnId?: string;
    model?: string;
    modelTier?: ModelTier;
    route?: RunRoute;
    agent?: string;
    hasPlan: boolean;
    plan?: RunPlan;
    steps: PlanStep[];
    queuePosition?: number;
    text: string;
    charts: CopilotChart[];
    usage?: CopilotUsage;
    tools?: string[];
    executionMs?: number;
    resultData?: CopilotResultData;
    error?: CopilotErrorPayload;
    lastEventId?: string;
    startedAt?: number;
    rebuilt?: boolean;
    offline: boolean;
}
export interface SendTurnInput {
    prompt: string;
    threadId?: string;
    scope?: JsonObject;
    idempotencyKey?: string;
    modelTier?: ModelTier;
    surface?: 'web' | 'mobile' | 'embed' | 'api';
}
