// Core domain types for the NETIX copilot.
// The event vocabulary here mirrors exactly what ml-engine emits over SSE.

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

// Every event name the backend can emit. `plan` is optional in the sense that a run may
// never emit it -- the direct router bypasses the orchestrator -- so nothing may block on it.
export const COPILOT_EVENT_NAMES = [
  'run_started',
  'queued',
  'plan',
  'step_started',
  'step_result',
  'message_delta',
  'chart',
  'usage',
  'done',
  'error',
  'cancelled',
] as const

export type CopilotEventName = (typeof COPILOT_EVENT_NAMES)[number]

export type StepStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'error'
  | 'skipped'
  | 'awaiting_approval'
  | 'rejected'
  | 'cancelled'

export interface PlanStep {
  id: string
  title: string
  tool?: string
  status: StepStatus
  // Short human-readable summary of the arguments, never the raw argument payload.
  argsSummary?: string
  durationMs?: number
  detail?: string
}

export interface CopilotUsage {
  creditsUsed?: number
  // Only ever populated when the backend sends it. ml-engine currently keeps its monthly chat
  // credit balance in logs and never returns it, so the usage footer hides the figure instead
  // of showing a zero.
  creditsRemaining?: number
  tokensIn?: number
  tokensOut?: number
  // LLM round trips for the turn, reported by the live agentic contract.
  calls?: number
  costUsd?: number
  model?: string
}

export interface CopilotErrorPayload {
  message: string
  code?: string
  retryable?: boolean
}

export interface RunStartedEvent {
  type: 'run_started'
  turnId: string
  model?: string
  creditsRemaining?: number
}

export interface QueuedEvent {
  type: 'queued'
  position?: number
}

export interface PlanEvent {
  type: 'plan'
  steps: PlanStep[]
}

export interface StepStartedEvent {
  type: 'step_started'
  step: PlanStep
}

export interface StepResultEvent {
  type: 'step_result'
  step: PlanStep
}

export interface MessageDeltaEvent {
  type: 'message_delta'
  text: string
}

export interface ChartEvent {
  type: 'chart'
  // Raw ECharts option JSON. The SDK never parses or renders it, the host chart adapter does.
  option: JsonObject
  title?: string
  chartId?: string
}

export interface UsageEvent {
  type: 'usage'
  usage: CopilotUsage
}

export interface DoneEvent {
  type: 'done'
  turnId?: string
}

export interface ErrorEvent {
  type: 'error'
  error: CopilotErrorPayload
}

export interface CancelledEvent {
  type: 'cancelled'
  reason?: string
}

export type CopilotEvent =
  | RunStartedEvent
  | QueuedEvent
  | PlanEvent
  | StepStartedEvent
  | StepResultEvent
  | MessageDeltaEvent
  | ChartEvent
  | UsageEvent
  | DoneEvent
  | ErrorEvent
  | CancelledEvent

// An event as it came off the wire, with the SSE id retained so a resume can replay from it.
export interface EnvelopedEvent {
  event: CopilotEvent
  id?: string
}

export type RunStatus =
  'idle' | 'creating' | 'queued' | 'streaming' | 'paused' | 'done' | 'error' | 'cancelled'

export interface CopilotChart {
  id: string
  option: JsonObject
  title?: string
}

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  charts?: CopilotChart[]
  error?: CopilotErrorPayload
}

export interface CopilotThread {
  id: string
  title: string
  updatedAt: number
  messageCount?: number
}

export interface RunState {
  status: RunStatus
  turnId?: string
  model?: string
  // Set the moment a `plan` arrives. Stays false for direct-router runs and that is not an error.
  hasPlan: boolean
  steps: PlanStep[]
  queuePosition?: number
  text: string
  charts: CopilotChart[]
  usage?: CopilotUsage
  error?: CopilotErrorPayload
  lastEventId?: string
  // True while the reader is intentionally suspended because the browser went offline.
  offline: boolean
}

export interface SendTurnInput {
  prompt: string
  threadId?: string
  // Opaque host scope. Serialized as-is into the create-turn request body.
  scope?: JsonObject
}
