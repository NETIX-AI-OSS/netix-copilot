// Core domain types for the NETIX copilot.
// The event vocabulary here mirrors exactly what ml-engine emits over SSE.

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

export type ModelTier = 'base' | 'high' | 'max'

export interface ModelTierMetadata {
  key: ModelTier
  label: string
  multiplier: 1 | 5 | 20
}

export const MODEL_TIERS: readonly ModelTierMetadata[] = [
  { key: 'base', label: 'Base 1x', multiplier: 1 },
  { key: 'high', label: 'High 5x', multiplier: 5 },
  { key: 'max', label: 'Max 20x', multiplier: 20 },
] as const

export function modelTierMetadata(tier: ModelTier): ModelTierMetadata {
  return MODEL_TIERS.find((entry) => entry.key === tier) ?? MODEL_TIERS[0]!
}

// Every event name the backend can emit. `plan` is optional in the sense that a run may
// never emit it -- the direct router bypasses the orchestrator -- so nothing may block on it.
// `agent_started` / `agent_finished` arrive only from an ml-engine that tags specialist runs;
// an older backend never sends them and the trace still renders from the step events alone.
export const COPILOT_EVENT_NAMES = [
  'run_started',
  'queued',
  'plan',
  'agent_started',
  'agent_finished',
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

// 'agent' is a specialist delegation (a `call_*_agent` meta-tool), 'tool' any other call.
// 'plan' is reserved for a plan line that the backend one day keys to a step id.
export type StepKind = 'tool' | 'agent' | 'plan'

export type RunRoute = 'direct' | 'orchestrator'

export interface PlanStep {
  id: string
  title: string
  tool?: string
  status: StepStatus
  kind?: StepKind
  // Short human-readable summary of the arguments, never the raw argument payload.
  argsSummary?: string
  durationMs?: number
  detail?: string
  // Lineage. `agent` names the specialist that made this call (ml-engine class name such as
  // 'FacilitiesAgent'); `parentId` is the id of the `call_*_agent` step it ran under. Both are
  // absent on the flat stream an untagged backend sends and are filled in from the stored
  // sub_execution_log once the run ends, so a trace can nest after the fact.
  agent?: string
  parentId?: string
  depth?: number
  startedAt?: number
  finishedAt?: number
  // The orchestrator's instruction to a specialist -- the one genuinely reasoned text a run
  // carries besides the plan -- and the feedback it gave on a re-invocation.
  task?: string
  feedback?: string
  // Approval steps: when the backend will treat silence as a rejection (epoch ms).
  expiresAt?: number
  // The tool's stored output, present only on a turn rebuilt from history. Never on the wire.
  output?: JsonValue
}

export interface RunPlan {
  reasoning?: string
  // The plan as the model wrote it: free text lines with no ids, so they are shown, never
  // matched against steps.
  lines: string[]
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
// They ride on `done` and `error` because the decoder accepts a closed set of event names and
// would drop an unknown one silently.
export interface CopilotRunSummary {
  // Tool names the run actually used, as ml-engine reports them on the request resource.
  tools?: string[]
  // Wall-clock time for the whole run. ml-engine reports `execution_time` in seconds.
  executionMs?: number
  resultData?: CopilotResultData
  // Steps rebuilt from the stored trace once the run ended. The transport attaches them so a
  // live run gains lineage, timing and outputs the stream could not carry.
  steps?: PlanStep[]
  plan?: RunPlan
}

export type CopilotErrorCause = 'budget' | 'tool_error' | 'provider' | 'internal'

export interface CopilotErrorPayload {
  message: string
  code?: string
  cause?: CopilotErrorCause
  retryable?: boolean
}

export interface RunStartedEvent {
  type: 'run_started'
  turnId: string
  model?: string
  modelTier?: ModelTier
  creditsRemaining?: number
  route?: RunRoute
  // The specialist answering a direct-routed run.
  agent?: string
  startedAt?: number
}

export interface QueuedEvent {
  type: 'queued'
  position?: number
}

export interface PlanEvent {
  type: 'plan'
  // Structured steps, when the backend keys them. ml-engine sends free strings instead, which
  // land in `lines`.
  steps: PlanStep[]
  lines?: string[]
  reasoning?: string
}

export interface AgentStartedEvent {
  type: 'agent_started'
  agent: string
  // The call id of the `call_*_agent` meta-tool, which is also the id of the step it upserts.
  callId: string
  parentId?: string
  task?: string
  feedback?: string
  startedAt?: number
}

export interface AgentFinishedEvent {
  type: 'agent_finished'
  agent: string
  callId: string
  status: 'ok' | 'error'
  durationMs?: number
  toolsUsed?: string[]
  responseChars?: number
  chartAvailable?: boolean
  finishedAt?: number
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
  | AgentStartedEvent
  | AgentFinishedEvent
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
  modelTier?: ModelTier
  isPinned?: boolean
  surface?: string
  createdAt?: number
}

export interface RunState {
  status: RunStatus
  turnId?: string
  model?: string
  modelTier?: ModelTier
  route?: RunRoute
  // The specialist answering a direct-routed run, when the backend names it.
  agent?: string
  // Set the moment a `plan` arrives. Stays false for direct-router runs and that is not an error.
  hasPlan: boolean
  plan?: RunPlan
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
  // When the run started on the server (epoch ms), for a live elapsed counter.
  startedAt?: number
  // True when the steps were rebuilt from stored history because live events were missed
  // (a late reconnect, an expired stream), so the trace can say so.
  rebuilt?: boolean
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
  modelTier?: ModelTier
  surface?: 'web' | 'mobile' | 'embed' | 'api'
}
