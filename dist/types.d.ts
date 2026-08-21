export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
export type JsonObject = {
    [key: string]: JsonValue;
};
export declare const COPILOT_EVENT_NAMES: readonly ["run_started", "queued", "plan", "step_started", "step_result", "message_delta", "chart", "usage", "done", "error", "cancelled"];
export type CopilotEventName = (typeof COPILOT_EVENT_NAMES)[number];
export type StepStatus = 'pending' | 'running' | 'ok' | 'error' | 'skipped' | 'awaiting_approval' | 'rejected' | 'cancelled';
export interface PlanStep {
    id: string;
    title: string;
    tool?: string;
    status: StepStatus;
    argsSummary?: string;
    durationMs?: number;
    detail?: string;
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
export interface CopilotErrorPayload {
    message: string;
    code?: string;
    retryable?: boolean;
}
export interface RunStartedEvent {
    type: 'run_started';
    turnId: string;
    model?: string;
    creditsRemaining?: number;
}
export interface QueuedEvent {
    type: 'queued';
    position?: number;
}
export interface PlanEvent {
    type: 'plan';
    steps: PlanStep[];
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
export interface DoneEvent {
    type: 'done';
    turnId?: string;
}
export interface ErrorEvent {
    type: 'error';
    error: CopilotErrorPayload;
}
export interface CancelledEvent {
    type: 'cancelled';
    reason?: string;
}
export type CopilotEvent = RunStartedEvent | QueuedEvent | PlanEvent | StepStartedEvent | StepResultEvent | MessageDeltaEvent | ChartEvent | UsageEvent | DoneEvent | ErrorEvent | CancelledEvent;
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
}
export interface RunState {
    status: RunStatus;
    turnId?: string;
    model?: string;
    hasPlan: boolean;
    steps: PlanStep[];
    queuePosition?: number;
    text: string;
    charts: CopilotChart[];
    usage?: CopilotUsage;
    error?: CopilotErrorPayload;
    lastEventId?: string;
    offline: boolean;
}
export interface SendTurnInput {
    prompt: string;
    threadId?: string;
    scope?: JsonObject;
}
