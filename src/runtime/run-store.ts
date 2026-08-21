// The pure reduction from events to renderable run state.
// Kept free of React and of the network so it can be tested as a table of event sequences.

import type { CopilotEvent, CopilotUsage, EnvelopedEvent, PlanStep, RunState } from '../types'

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

export function applyEvent(state: RunState, event: CopilotEvent): RunState {
  switch (event.type) {
    case 'run_started': {
      const next: RunState = { ...state, status: 'streaming', turnId: event.turnId }
      if (event.model !== undefined) next.model = event.model
      if (event.creditsRemaining !== undefined) {
        next.usage = mergeUsage(state.usage, { creditsRemaining: event.creditsRemaining })
      }
      return next
    }
    case 'queued': {
      const next: RunState = { ...state, status: 'queued' }
      if (event.position !== undefined) next.queuePosition = event.position
      return next
    }
    case 'plan':
      // A run without a plan is normal: the direct router answers single-domain prompts without
      // ever consulting the orchestrator. Nothing may wait on this event.
      return {
        ...state,
        hasPlan: true,
        status: state.status === 'queued' ? 'streaming' : state.status,
        steps: event.steps.reduce(upsertStep, state.steps),
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
      return { ...state, status: 'done', offline: false }
    case 'error':
      return { ...state, status: 'error', error: event.error, offline: false }
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
