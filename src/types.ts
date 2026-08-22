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
  // ml-engine computes this live and never persists it, so it is present on a fresh answer and
  // absent when a stored turn is replayed. Undefined means unknown, never zero.
  creditsRemaining?: number
  tokensIn?: number
  tokensOut?: number
  // LLM round trips for the turn, reported by the live agentic contract.
  calls?: number
  costUsd?: number
  model?: string
}

// A tabular result the backend returns alongside the prose answer.
// The wire shape varies -- {columns, data}, {columns, rows}, a bare array of row objects or a
// scalar -- so it is normalized to one shape here and the untouched payload is kept beside it.
export interface CopilotResultData {
  columns: string[]
  rows: JsonObject[]
  raw: JsonValue
}

// Run-level facts the backend reports with the terminal payload rather than as their own event.
// They ride on `done` and `error` because the decoder accepts eleven event names and would drop
// a twelfth silently.
export interface CopilotRunSummary {
  // Tool names the run actually used, as ml-engine reports them on the request resource.
  tools?: string[]
  // Wall-clock time for the whole run. ml-engine reports `execution_time` in seconds.
  executionMs?: number
  resultData?: CopilotResultData
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

export interface DoneEvent extends CopilotRunSummary {
  type: 'done'
  turnId?: string
}

export interface ErrorEvent extends CopilotRunSummary {
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
  // Populated from the terminal payload, so a finished turn can show what it used and how long
  // it took without the host refetching the request resource.
  tools?: string[]
  executionMs?: number
  resultData?: CopilotResultData
  error?: CopilotErrorPayload
  lastEventId?: string
  // True while the reader is intentionally suspended because the browser went offline.
  offline: boolean
}

export interface SendTurnInput {
  prompt: string
  threadId?: string
  // Host page context. Never a wire field: ml-engine's create accepts no scope key, so a host
  // that needs the model to see its context folds it into the prompt through `transformPrompt`.
  // The agentic transport reads organization_id and user_id out of it, which is why it is here.
  scope?: JsonObject
  // Sent as the Idempotency-Key header, so a retried create replays instead of spending again.
  idempotencyKey?: string
}
