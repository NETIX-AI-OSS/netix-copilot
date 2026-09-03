// The reasoning trace as a tree.
//
// ml-engine streams every tool call flat, in the order it started, and a specialist's calls are
// indistinguishable from the orchestrator's until the backend tags them or the stored
// sub_execution_log is read back. This module is the one place that turns the flat step list
// into what the trace renders, so the components never reason about lineage themselves.

import type { PlanStep } from '../types'

export interface TraceNode {
  step: PlanStep
  children: TraceNode[]
}

// The orchestrator's meta-tools, one per specialist: call_facilities_agent, call_asset_agent...
const AGENT_TOOL_RE = /^call_([a-z0-9_]+)_agent$/

// ml-engine class names map onto the same keys: FacilitiesAgent -> facilities,
// WorkOrdersAgent -> work_orders, TuningAdvisorAgent -> tuning_advisor.
const AGENT_CLASS_RE = /^([A-Z][A-Za-z0-9]*?)Agent$/

export function isAgentStep(step: PlanStep): boolean {
  if (step.kind === 'agent') return true
  if (step.kind !== undefined) return false
  return step.tool !== undefined && AGENT_TOOL_RE.test(step.tool)
}

// The i18n key suffix for a specialist, from either spelling ml-engine uses.
export function agentKey(nameOrTool: string): string | undefined {
  const tool = AGENT_TOOL_RE.exec(nameOrTool)
  if (tool) return tool[1]
  const cls = AGENT_CLASS_RE.exec(nameOrTool)
  if (cls) {
    return cls[1]!.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  }
  return undefined
}

// Nest steps by `parentId`, keeping arrival order at every level. A parent that never arrived
// (a child event outran its agent, or the stream lost it) leaves the child at the top level
// rather than dropping it: a trace that hides work is worse than one that misplaces it.
export function buildTraceTree(steps: readonly PlanStep[]): TraceNode[] {
  const nodes = new Map<string, TraceNode>()
  for (const step of steps) nodes.set(step.id, { step, children: [] })
  const roots: TraceNode[] = []
  for (const step of steps) {
    const node = nodes.get(step.id)!
    const parent = step.parentId !== undefined ? nodes.get(step.parentId) : undefined
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

// The specialists a run consulted, in first-seen order, from whichever signal is present.
export function agentSteps(steps: readonly PlanStep[]): PlanStep[] {
  return steps.filter(isAgentStep)
}

export function countSteps(nodes: readonly TraceNode[]): number {
  let total = 0
  for (const node of nodes) total += 1 + countSteps(node.children)
  return total
}

// How long a step took, or has been running for when `nowMs` is supplied. Prefers the backend's
// own duration; the wall-clock pair is the fallback, and a live figure is only ever derived from
// a start the backend reported.
export function stepElapsedMs(step: PlanStep, nowMs?: number): number | undefined {
  if (step.durationMs !== undefined) return step.durationMs
  if (step.startedAt === undefined) return undefined
  if (step.finishedAt !== undefined) return Math.max(0, step.finishedAt - step.startedAt)
  if (step.status === 'running' && nowMs !== undefined) return Math.max(0, nowMs - step.startedAt)
  return undefined
}
