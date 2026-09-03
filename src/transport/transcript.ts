// Rebuilding a stored run into the shape a live run ends in.
//
// ml-engine stores the same run twice under two names: AgenticMLRequest, where one row is a whole
// thread, and ConversationTurn, where one row is a single turn. The columns are the same either
// way, so the reconstruction lives here once and each transport supplies its own row grouping.
//
// The point of doing this at all is that adopting the SDK must not lose history. A replayed turn
// carries its plan, its tool calls, its chart, its result table and its timing, so it renders
// through exactly the same components as the turn that just finished streaming.

import { isAgentStep } from '../runtime/trace-model'
import type {
  CopilotChart,
  CopilotResultData,
  CopilotRunSummary,
  CopilotUsage,
  JsonObject,
  JsonValue,
  PlanStep,
  RunPlan,
  RunState,
} from '../types'
import { normalizeResultData } from './result-data'
import type { CopilotTranscriptTurn } from './types'

// service/models.py StatusChoices.
export const AGENTIC_STATUS = {
  PENDING: 0,
  COMPLETED: 1,
  ERRORED: 2,
  PROCESSING: 3,
  CANCELLED: 4,
} as const

// The columns AgenticMLRequest and ConversationTurn have in common, plus the two that only one
// of them serves. Everything is optional because both serializers null most of it mid-run.
export interface CopilotRunRow {
  id?: number | string
  status?: number
  prompt_text?: string
  response_text?: string | null
  chart_config?: Record<string, unknown> | null
  chart_available?: boolean | null
  plan?: unknown[] | null
  execution_log?: unknown[] | null
  tools?: readonly (string | null)[] | null
  error?: string | null
  execution_time?: number | null
  usage?: Record<string, unknown> | null
  result_data?: unknown
  messages?: unknown
  model?: string | null
  model_tier?: string | null
  created_on?: string
  updated_on?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// execution_log entries are { tool, call_id, iteration, arguments, output } with `arguments` as a
// real object on REST and as a truncated string on the stream, so both have to flatten to a line.
export function summarizeArguments(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (!isRecord(value)) return undefined
  const parts: string[] = []
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || entry === undefined) continue
    const rendered =
      typeof entry === 'object'
        ? Array.isArray(entry)
          ? `[${entry.length}]`
          : '{…}'
        : String(entry)
    parts.push(`${key}=${rendered}`)
    if (parts.length === 4) break
  }
  if (parts.length === 0) return undefined
  const summary = parts.join(', ')
  return summary.length > 160 ? `${summary.slice(0, 157)}…` : summary
}

export function readStepId(entry: Record<string, unknown>, index: number): string {
  const callId = entry.call_id ?? entry.callId
  if (typeof callId === 'string' && callId !== '') return callId
  return `step-${index}`
}

export function readStepTitle(entry: Record<string, unknown>, index: number): string {
  if (typeof entry.tool === 'string' && entry.tool !== '') return entry.tool
  if (typeof entry.detail === 'string' && entry.detail !== '') return entry.detail
  return `Step ${index + 1}`
}

// The stored `plan` column is ml-engine's plan_trace, whose entries carry in_progress, completed,
// errored or rejected. Collapsing everything that is not 'completed' to pending would render a
// failed step as one still waiting to run.
const PLAN_STATUSES: Record<string, PlanStep['status']> = {
  in_progress: 'running',
  completed: 'ok',
  errored: 'error',
  rejected: 'rejected',
  awaiting_approval: 'awaiting_approval',
  cancelled: 'cancelled',
  skipped: 'skipped',
}

function planStatus(value: unknown): PlanStep['status'] {
  return typeof value === 'string' ? (PLAN_STATUSES[value] ?? 'pending') : 'pending'
}

// The orchestrator's planning call. Its output is the plan the model wrote, so it becomes the
// run's RunPlan rather than a step of its own.
const PLAN_TOOL = 'make_plan'

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// The lineage and timing a newer ml-engine persists on plan_trace and sub_execution_log entries.
function lineageOf(entry: Record<string, unknown>): Partial<PlanStep> {
  const parentId = entry.parent_call_id ?? entry.parentCallId
  const depth = readNumber(entry.depth)
  const startedAt = readNumber(entry.started_at ?? entry.startedAt)
  const finishedAt = readNumber(entry.finished_at ?? entry.finishedAt)
  const durationMs = readNumber(entry.duration_ms ?? entry.durationMs)
  return {
    ...(typeof entry.agent === 'string' ? { agent: entry.agent } : {}),
    ...(typeof parentId === 'string' && parentId !== '' ? { parentId } : {}),
    ...(depth === undefined ? {} : { depth }),
    ...(startedAt === undefined ? {} : { startedAt }),
    ...(finishedAt === undefined ? {} : { finishedAt }),
    ...(durationMs === undefined ? {} : { durationMs }),
  }
}

// A `call_*_agent` entry is a specialist delegation: its arguments carry the orchestrator's task,
// and the stored output names the specialist class that ran it.
function withKind(step: PlanStep, entry: Record<string, unknown>): PlanStep {
  if (!isAgentStep(step)) return { ...step, kind: 'tool' }
  const args = isRecord(entry.arguments) ? entry.arguments : {}
  const output = isRecord(entry.output) ? entry.output : {}
  const task = typeof args.task === 'string' && args.task !== '' ? args.task : undefined
  const feedback =
    typeof args.feedback === 'string' && args.feedback !== '' ? args.feedback : undefined
  return {
    ...step,
    kind: 'agent',
    title: task ?? step.title,
    ...(typeof output.specialist === 'string' ? { agent: output.specialist } : {}),
    ...(task === undefined ? {} : { task }),
    ...(feedback === undefined ? {} : { feedback }),
  }
}

export function planSteps(plan: unknown[]): PlanStep[] {
  return plan
    .filter(isRecord)
    .filter((entry) => entry.tool !== PLAN_TOOL)
    .map((entry, index) => {
      const summary = summarizeArguments(entry.arguments)
      return withKind(
        {
          id: readStepId(entry, index),
          title: readStepTitle(entry, index),
          status: planStatus(entry.status),
          ...(typeof entry.tool === 'string' ? { tool: entry.tool } : {}),
          ...(summary === undefined ? {} : { argsSummary: summary }),
          ...(typeof entry.detail === 'string' ? { detail: entry.detail } : {}),
          ...lineageOf(entry),
        },
        entry,
      )
    })
}

// How base.py sets a trace status: a stored status when there is one, otherwise a result carrying
// `error` failed unless its approval_status says how. Keeping to that rule is what lets the log
// entry and its plan_trace twin agree when they merge.
function outputStatus(entry: Record<string, unknown>): PlanStep['status'] {
  if (typeof entry.status === 'string') {
    const known = PLAN_STATUSES[entry.status]
    if (known !== undefined) return known
    if (entry.status === 'ok') return 'ok'
    if (entry.status === 'error') return 'error'
  }
  const output = isRecord(entry.output) ? entry.output : undefined
  if (output === undefined || output.error === undefined) return 'ok'
  const approval =
    typeof output.approval_status === 'string' ? PLAN_STATUSES[output.approval_status] : undefined
  return approval ?? 'error'
}

export function logStep(entry: Record<string, unknown>, index: number): PlanStep {
  const summary = summarizeArguments(entry.arguments)
  return withKind(
    {
      id: readStepId(entry, index),
      title: readStepTitle(entry, index),
      status: outputStatus(entry),
      ...(typeof entry.tool === 'string' ? { tool: entry.tool } : {}),
      ...(summary === undefined ? {} : { argsSummary: summary }),
      ...lineageOf(entry),
      ...(entry.output === undefined ? {} : { output: entry.output as JsonValue }),
    },
    entry,
  )
}

// A specialist's own tool calls, stored under the meta-tool's output. Their call_ids are the ones
// the live step events carried, so a flat live trace re-parents rather than duplicates; an older
// backend that stored none gets ids derived from the parent instead.
function childSteps(parent: PlanStep, entry: Record<string, unknown>): PlanStep[] {
  const output = isRecord(entry.output) ? entry.output : {}
  const log = Array.isArray(output.sub_execution_log) ? output.sub_execution_log : []
  const agent = typeof output.specialist === 'string' ? output.specialist : parent.agent
  return log.filter(isRecord).map((child, index) => {
    const callId = child.call_id ?? child.callId
    const summary = summarizeArguments(child.arguments)
    return {
      id: typeof callId === 'string' && callId !== '' ? callId : `${parent.id}-${index}`,
      title: readStepTitle(child, index),
      status: outputStatus(child),
      kind: 'tool',
      ...(typeof child.tool === 'string' ? { tool: child.tool } : {}),
      ...(summary === undefined ? {} : { argsSummary: summary }),
      ...(typeof child.detail === 'string' ? { detail: child.detail } : {}),
      ...lineageOf(child),
      ...(agent === undefined ? {} : { agent }),
      parentId: parent.id,
      depth: (parent.depth ?? 0) + 1,
      ...(child.output === undefined ? {} : { output: child.output as JsonValue }),
    }
  })
}

// One execution_log entry as the steps it describes: the call itself, then the specialist's
// calls beneath it. Every path that reads a stored row nests through this one function.
export function logSteps(entry: Record<string, unknown>, index: number): PlanStep[] {
  const step = logStep(entry, index)
  return step.kind === 'agent' ? [step, ...childSteps(step, entry)] : [step]
}

// The plan the model wrote, from the make_plan entry's stored output.
export function readPlanOutput(entry: Record<string, unknown>): RunPlan | undefined {
  if (entry.tool !== PLAN_TOOL) return undefined
  const output = isRecord(entry.output) ? entry.output : {}
  const lines = Array.isArray(output.steps)
    ? output.steps.filter((line): line is string => typeof line === 'string')
    : []
  const reasoning = typeof output.reasoning === 'string' ? output.reasoning : undefined
  return { ...(reasoning === undefined ? {} : { reasoning }), lines }
}

export interface RebuiltRun {
  steps: PlanStep[]
  plan?: RunPlan
}

// The trace tree from a stored row: plan_trace and execution_log describe the same calls under
// the same call_id, the make_plan entry yields the plan, and each call_*_agent entry brings its
// specialist's calls in beneath it. Plan lines are shown as written, never as pending steps.
export function rebuildRun(row: CopilotRunRow): RebuiltRun {
  const stored = Array.isArray(row.plan) ? row.plan : []
  const lines = stored.filter((line): line is string => typeof line === 'string')
  let plan: RunPlan | undefined = lines.length > 0 ? { lines } : undefined
  const steps = planSteps(stored)
  const log = (Array.isArray(row.execution_log) ? row.execution_log : []).filter(isRecord)
  for (let index = 0; index < log.length; index += 1) {
    const entry = log[index]!
    const planned = readPlanOutput(entry)
    if (planned !== undefined) plan = planned
    else steps.push(...logSteps(entry, index))
  }
  return { steps: mergeSteps(steps), ...(plan === undefined ? {} : { plan }) }
}

// plan_trace and execution_log describe the same tool calls under the same call_id, so a
// transcript that concatenated them would render every step twice.
export function mergeSteps(steps: PlanStep[]): PlanStep[] {
  const merged: PlanStep[] = []
  for (const step of steps) {
    const index = merged.findIndex((entry) => entry.id === step.id)
    if (index === -1) merged.push(step)
    else merged[index] = { ...merged[index], ...step } as PlanStep
  }
  return merged
}

// ml-engine's result_data field only populates for Responses-API shaped messages and is null for
// every run the current agent loop produces, so the newest tool output is the real source.
function lastToolOutput(row: CopilotRunRow): CopilotResultData | undefined {
  const log = Array.isArray(row.execution_log) ? row.execution_log : []
  for (let index = log.length - 1; index >= 0; index -= 1) {
    const entry = log[index]
    if (!isRecord(entry)) continue
    const table = normalizeResultData(entry.output)
    if (table !== undefined && table.rows.length > 0) return table
  }
  return undefined
}

export function readRunSummary(row: CopilotRunRow): CopilotRunSummary {
  const summary: CopilotRunSummary = {}
  if (Array.isArray(row.tools)) {
    const tools = row.tools.filter((tool): tool is string => typeof tool === 'string')
    if (tools.length > 0) summary.tools = tools
  }
  if (typeof row.execution_time === 'number' && Number.isFinite(row.execution_time)) {
    summary.executionMs = Math.round(row.execution_time * 1000)
  }
  const resultData = normalizeResultData(row.result_data) ?? lastToolOutput(row)
  if (resultData !== undefined) summary.resultData = resultData
  // The stored trace rides along, so a run that streamed flat nests once it ends.
  const { steps, plan } = rebuildRun(row)
  if (steps.length > 0) summary.steps = steps
  if (plan !== undefined) summary.plan = plan
  return summary
}

// ml-engine computes credits_remaining live and does not persist it, so it is present on a run
// that just executed and absent on one replayed from storage. It is read here, not dropped.
export function mapUsage(usage: Record<string, unknown> | null | undefined): CopilotUsage {
  if (!usage) return {}
  const mapped: CopilotUsage = {}
  if (typeof usage.prompt_tokens === 'number') mapped.tokensIn = usage.prompt_tokens
  if (typeof usage.completion_tokens === 'number') mapped.tokensOut = usage.completion_tokens
  if (typeof usage.calls === 'number') mapped.calls = usage.calls
  if (typeof usage.cost_usd === 'number') mapped.costUsd = usage.cost_usd
  if (typeof usage.credits_used === 'number') mapped.creditsUsed = usage.credits_used
  if (typeof usage.credits_remaining === 'number') {
    mapped.creditsRemaining = usage.credits_remaining
  }
  if (typeof usage.model === 'string') mapped.model = usage.model
  return mapped
}

export function runStatusFrom(status: number | undefined): RunState['status'] {
  if (status === AGENTIC_STATUS.ERRORED) return 'error'
  if (status === AGENTIC_STATUS.CANCELLED) return 'cancelled'
  if (status === AGENTIC_STATUS.PROCESSING) return 'streaming'
  if (status === AGENTIC_STATUS.PENDING) return 'queued'
  return 'done'
}

export function emptyRun(): RunState {
  return { status: 'done', hasPlan: false, steps: [], text: '', charts: [], offline: false }
}

// `messages` is the raw chat array the run was built from, stored as JSON or as JSON text.
export function parseMessages(value: unknown): Array<{ role: string; content: string }> {
  const parsed =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown
          } catch {
            return undefined
          }
        })()
      : value
  if (!Array.isArray(parsed)) return []
  const messages: Array<{ role: string; content: string }> = []
  for (const entry of parsed) {
    if (!isRecord(entry)) continue
    const role = typeof entry.role === 'string' ? entry.role : ''
    const content = typeof entry.content === 'string' ? entry.content.trim() : ''
    if (content === '' || (role !== 'user' && role !== 'assistant')) continue
    messages.push({ role, content })
  }
  return messages
}

function chartsFrom(row: CopilotRunRow, idPrefix: string): CopilotChart[] {
  if (!isRecord(row.chart_config) || Object.keys(row.chart_config).length === 0) return []
  // chart_available is the flag the drawers gated on; an option object without it is still a
  // chart, so only an explicit false suppresses it.
  if (row.chart_available === false) return []
  return [{ id: `${idPrefix}-chart-1`, option: row.chart_config as JsonObject }]
}

export function timestampOf(row: CopilotRunRow): number {
  const raw = row.created_on ?? row.updated_on
  const parsed = raw === undefined ? Number.NaN : Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

// Everything the row says about its own answer, applied over whatever text is already there.
export function runFromRow(row: CopilotRunRow, idPrefix: string, base: RunState): RunState {
  const usage = mapUsage(row.usage)
  const error = row.error?.trim()
  const text = base.text === '' ? (row.response_text?.trim() ?? '') : base.text
  const summary = readRunSummary(row)
  return {
    ...base,
    ...summary,
    status: runStatusFrom(row.status),
    hasPlan: summary.plan !== undefined || (Array.isArray(row.plan) && row.plan.length > 0),
    steps: summary.steps ?? [],
    charts: chartsFrom(row, idPrefix),
    text,
    ...(row.model ? { model: row.model } : {}),
    ...(row.model_tier === 'base' || row.model_tier === 'high' || row.model_tier === 'max'
      ? { modelTier: row.model_tier }
      : {}),
    ...(Object.keys(usage).length > 0 ? { usage } : {}),
    ...(error ? { error: { message: error } } : {}),
  }
}

// One AgenticMLRequest row is a whole thread: its `messages` array holds every exchange and its
// artifacts describe the latest answer, so they land on the last turn.
export function transcriptFromRequest(
  row: CopilotRunRow,
  threadId: string,
): CopilotTranscriptTurn[] {
  const createdAt = timestampOf(row)
  const turns: CopilotTranscriptTurn[] = []

  for (const message of parseMessages(row.messages)) {
    const last = turns[turns.length - 1]
    if (message.role === 'user' || last === undefined) {
      turns.push({
        id: `${threadId}-${turns.length}`,
        prompt: message.role === 'user' ? message.content : '',
        createdAt,
        run: message.role === 'user' ? emptyRun() : { ...emptyRun(), text: message.content },
      })
      continue
    }
    if (last.run.text === '') last.run = { ...last.run, text: message.content }
  }

  if (turns.length === 0) {
    turns.push({
      id: `${threadId}-0`,
      prompt: row.prompt_text ?? '',
      createdAt,
      run: emptyRun(),
    })
  }

  const last = turns[turns.length - 1]
  if (last !== undefined) last.run = runFromRow(row, `${threadId}-${turns.length - 1}`, last.run)
  return turns
}

// One ConversationTurn row is one turn, and its own `messages` delta already contributed the
// answer text through `response_text`.
export function turnFromRow(
  row: CopilotRunRow,
  threadId: string,
  index: number,
): CopilotTranscriptTurn {
  const id = row.id === undefined ? `${threadId}-${index}` : String(row.id)
  return {
    id,
    prompt: row.prompt_text ?? '',
    createdAt: timestampOf(row),
    run: runFromRow(row, id, emptyRun()),
  }
}
