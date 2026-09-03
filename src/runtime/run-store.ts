// The pure reduction from events to renderable run state.
// Kept free of React and of the network so it can be tested as a table of event sequences.

import type {
  AgentFinishedEvent,
  AgentStartedEvent,
  CopilotEvent,
  CopilotRunSummary,
  CopilotUsage,
  EnvelopedEvent,
  PlanStep,
  RunState,
} from '../types'

export function initialRunState(): RunState {
  return {
    status: 'idle',
    hasPlan: false,
    steps: [],
    text: '',
    charts: [],
    offline: false,
  }
}

function upsertStep(steps: PlanStep[], incoming: PlanStep): PlanStep[] {
  const index = steps.findIndex((step) => step.id === incoming.id)
  if (index === -1) return [...steps, incoming]
  const next = steps.slice()
  // A later event only fills gaps: a step_result that omits the title keeps the planned one.
  next[index] = { ...next[index], ...incoming } as PlanStep
  return next
}

function mergeUsage(current: CopilotUsage | undefined, incoming: CopilotUsage): CopilotUsage {
  return { ...current, ...incoming }
}

// The meta-tool's own step_started usually lands first, so this upserts onto it: the tool name
// stays, the orchestrator's task becomes the title, and the card opens as running.
function agentStartedStep(event: AgentStartedEvent): PlanStep {
  return {
    id: event.callId,
    title: event.task ?? event.agent,
    status: 'running',
    kind: 'agent',
    agent: event.agent,
    ...(event.task === undefined ? {} : { task: event.task }),
    ...(event.feedback === undefined ? {} : { feedback: event.feedback }),
    ...(event.parentId === undefined ? {} : { parentId: event.parentId }),
    ...(event.startedAt === undefined ? {} : { startedAt: event.startedAt }),
  }
}

// Closes the card agent_started opened; the task stays the title, the outcome and timing land.
function agentFinishedStep(event: AgentFinishedEvent, current: PlanStep | undefined): PlanStep {
  return {
    id: event.callId,
    title: current?.title ?? event.agent,
    status: event.status,
    kind: 'agent',
    agent: event.agent,
    ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
    ...(event.finishedAt === undefined ? {} : { finishedAt: event.finishedAt }),
  }
}

// Only the keys the terminal payload actually carried, so a summary that omits execution_time
// does not blank one an earlier event already recorded.
function applySummary(state: RunState, summary: CopilotRunSummary): Partial<RunState> {
  const patch: Partial<RunState> = {}
  if (summary.tools !== undefined) patch.tools = summary.tools
  if (summary.executionMs !== undefined) patch.executionMs = summary.executionMs
  if (summary.resultData !== undefined) patch.resultData = summary.resultData
  if (summary.steps !== undefined) {
    // Stored history knows lineage the stream may not have carried. A step the stream never saw,
    // or a parent it never named, means the trace is being rebuilt rather than confirmed.
    const rebuilt = summary.steps.some((step) => {
      const seen = state.steps.find((entry) => entry.id === step.id)
      return seen === undefined || (step.parentId !== undefined && seen.parentId === undefined)
    })
    patch.steps = summary.steps.reduce(upsertStep, state.steps)
    if (rebuilt) patch.rebuilt = true
  }
  if (summary.plan !== undefined) {
    patch.plan = state.plan ?? summary.plan
    patch.hasPlan = true
  }
  return patch
}

export function applyEvent(state: RunState, event: CopilotEvent): RunState {
  switch (event.type) {
    case 'run_started': {
      const next: RunState = { ...state, status: 'streaming', turnId: event.turnId }
      if (event.model !== undefined) next.model = event.model
      if (event.modelTier !== undefined) next.modelTier = event.modelTier
      if (event.creditsRemaining !== undefined) {
        next.usage = mergeUsage(state.usage, { creditsRemaining: event.creditsRemaining })
      }
      if (event.route !== undefined) next.route = event.route
      if (event.agent !== undefined) next.agent = event.agent
      if (event.startedAt !== undefined) next.startedAt = event.startedAt
      return next
    }
    case 'queued': {
      const next: RunState = { ...state, status: 'queued' }
      if (event.position !== undefined) next.queuePosition = event.position
      return next
    }
    case 'plan': {
      // A run without a plan is normal: the direct router answers single-domain prompts without
      // ever consulting the orchestrator. Nothing may wait on this event.
      const next: RunState = {
        ...state,
        hasPlan: true,
        status: state.status === 'queued' ? 'streaming' : state.status,
        steps: event.steps.reduce(upsertStep, state.steps),
      }
      if (event.lines !== undefined || event.reasoning !== undefined) {
        const reasoning = event.reasoning ?? state.plan?.reasoning
        next.plan = {
          ...(reasoning === undefined ? {} : { reasoning }),
          lines: event.lines ?? state.plan?.lines ?? [],
        }
      }
      return next
    }
    case 'agent_started':
      return {
        ...state,
        status: state.status === 'queued' ? 'streaming' : state.status,
        steps: upsertStep(state.steps, agentStartedStep(event)),
      }
    case 'agent_finished': {
      const current = state.steps.find((step) => step.id === event.callId)
      return { ...state, steps: upsertStep(state.steps, agentFinishedStep(event, current)) }
    }
    case 'step_started':
    case 'step_result':
      return {
        ...state,
        status: state.status === 'queued' ? 'streaming' : state.status,
        steps: upsertStep(state.steps, event.step),
      }
    case 'message_delta':
      return {
        ...state,
        status: state.status === 'queued' ? 'streaming' : state.status,
        text: state.text + event.text,
      }
    case 'chart': {
      const id = event.chartId ?? `chart-${state.charts.length + 1}`
      if (state.charts.some((chart) => chart.id === id)) return state
      const chart = { id, option: event.option, ...(event.title ? { title: event.title } : {}) }
      return { ...state, charts: [...state.charts, chart] }
    }
    case 'usage':
      return { ...state, usage: mergeUsage(state.usage, event.usage) }
    case 'done':
      return { ...state, ...applySummary(state, event), status: 'done', offline: false }
    case 'error':
      return {
        ...state,
        ...applySummary(state, event),
        status: 'error',
        error: event.error,
        offline: false,
      }
    case 'cancelled':
      return { ...state, status: 'cancelled', offline: false }
    default:
      return state
  }
}

export function applyEnveloped(state: RunState, enveloped: EnvelopedEvent): RunState {
  const next = applyEvent(state, enveloped.event)
  if (enveloped.id === undefined) return next
  return next === state
    ? { ...state, lastEventId: enveloped.id }
    : { ...next, lastEventId: enveloped.id }
}

const ACTIVE_STATUSES = new Set(['creating', 'queued', 'streaming'])

// True while the run should be holding a connection open.
export function isRunActive(state: RunState): boolean {
  return ACTIVE_STATUSES.has(state.status)
}

// True once the run has stopped for good. Distinct from isRunActive because a paused run is
// neither active nor finished.
export function isRunFinished(state: RunState): boolean {
  return state.status === 'done' || state.status === 'error' || state.status === 'cancelled'
}
