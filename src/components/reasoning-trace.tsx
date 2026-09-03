// The reasoning trace: a collapsible card between the user's bubble and the answer that narrates
// the run from real events only. Every label here is derived from run state the backend sent;
// the only pre-event affordance is the thinking dots.

import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { CopilotLabels, TranslateFn } from '../adapters/types'
import { isRunActive, isRunFinished } from '../runtime/run-store'
import type { TraceNode } from '../runtime/trace-model'
import { agentSteps, buildTraceTree, countSteps, isAgentStep } from '../runtime/trace-model'
import type { RunState } from '../types'
import { AgentCard } from './agent-card'
import type { GlyphKind } from './status-glyph'
import { StatusGlyph } from './status-glyph'
import { StepRow } from './step-row'
import { agentLabel, formatDuration } from './trace-labels'
import type { NowFn } from './use-now'
import { useNow, useSettled } from './use-now'

const AUTO_COLLAPSE_MS = 600
const LIVE_REGION_MS = 1000
const FINISHED_STATUSES = new Set(['ok', 'error', 'skipped', 'rejected', 'cancelled'])

export interface ReasoningTraceProps {
  run: RunState
  // Open by default while the run is live; a replayed turn starts collapsed. Read once, at
  // mount, so a host passing the live status each render does not reopen a collapsed card.
  defaultOpen?: boolean
  // The clock behind the elapsed counters. Tests inject one; hosts never need to.
  now?: NowFn
}

interface TraceHeader {
  glyph: GlyphKind
  label: string
}

// The run's own wall-clock figure when it reported one, else the span the step timestamps
// cover, else what the live counter last saw. Never invented.
function runElapsedMs(run: RunState, nowMs: number | undefined): number | undefined {
  if (run.executionMs !== undefined) return run.executionMs
  if (run.startedAt === undefined) return undefined
  const finished = run.steps.reduce<number | undefined>(
    (latest, step) =>
      step.finishedAt !== undefined && (latest === undefined || step.finishedAt > latest)
        ? step.finishedAt
        : latest,
    undefined,
  )
  const end = isRunFinished(run) ? (finished ?? nowMs) : nowMs
  return end === undefined ? undefined : Math.max(0, end - run.startedAt)
}

function describeRun(
  run: RunState,
  tree: TraceNode[],
  t: TranslateFn,
  labels: CopilotLabels | undefined,
  nowMs: number | undefined,
): TraceHeader {
  const total = countSteps(tree)
  // "Step k of n" names the step in flight: the finished ones plus the one running. Counting
  // every non-pending step would read "5 of 5" the moment five calls were dispatched together.
  const finished = run.steps.filter((step) => FINISHED_STATUSES.has(step.status)).length
  const inFlight = run.steps.some(
    (step) => !FINISHED_STATUSES.has(step.status) && step.status !== 'pending',
  )
  const settled = Math.min(total, finished + (inFlight ? 1 : 0))
  const agents = agentSteps(run.steps).length
  const awaiting = run.steps.some((step) => step.status === 'awaiting_approval')

  if (awaiting && !isRunFinished(run)) {
    return { glyph: 'shield', label: t('copilot.trace.awaiting') }
  }
  switch (run.status) {
    case 'creating':
    case 'queued':
      return {
        glyph: 'dots',
        label:
          run.status === 'queued' && run.queuePosition !== undefined
            ? t('copilot.status.queuedAt', { position: run.queuePosition })
            : t('copilot.trace.thinking'),
      }
    case 'streaming':
    case 'paused': {
      if (total === 0) {
        return run.hasPlan
          ? { glyph: 'ring', label: t('copilot.trace.planning') }
          : { glyph: 'dots', label: t('copilot.trace.thinking') }
      }
      if (run.hasPlan || agents > 0) {
        return { glyph: 'ring', label: t('copilot.trace.stepOf', { k: settled, n: total }) }
      }
      return {
        glyph: 'ring',
        label:
          run.agent === undefined ? t('copilot.trace.working') : agentLabel(t, labels, run.agent),
      }
    }
    case 'error':
      return { glyph: 'cross', label: t('copilot.trace.stopped', { steps: total }) }
    case 'cancelled':
      return { glyph: 'stop', label: t('copilot.trace.stopped', { steps: total }) }
    default: {
      const ms = runElapsedMs(run, nowMs)
      if (ms === undefined) {
        return { glyph: 'tick', label: t('copilot.trace.summarySteps', { steps: total }) }
      }
      const seconds = (ms / 1000).toFixed(1)
      return {
        glyph: 'tick',
        label:
          agents > 0
            ? t('copilot.trace.summaryAgents', { seconds, steps: total, agents })
            : t('copilot.trace.summary', { seconds, steps: total }),
      }
    }
  }
}

interface TraceNodesProps {
  nodes: TraceNode[]
  nowMs: number | undefined
}

// Recursion lives here so the cards and rows never import each other.
function TraceNodes({ nodes, nowMs }: TraceNodesProps): ReactNode {
  return (
    <ol className='nxcp-trace-nodes'>
      {nodes.map((node) => {
        const nested =
          node.children.length === 0 ? null : <TraceNodes nodes={node.children} nowMs={nowMs} />
        if (isAgentStep(node.step)) {
          return (
            <li key={node.step.id} className='nxcp-trace-node' data-kind='agent'>
              <AgentCard step={node.step} nowMs={nowMs}>
                {nested}
              </AgentCard>
            </li>
          )
        }
        return (
          <StepRow key={node.step.id} step={node.step} nowMs={nowMs}>
            {nested}
          </StepRow>
        )
      })}
    </ol>
  )
}

export function ReasoningTrace({ run, defaultOpen, now }: ReasoningTraceProps): ReactNode {
  const { t, labels } = useCopilotAdapters()
  const bodyId = useId()
  const [initialOpen] = useState(defaultOpen ?? false)
  const [userOpen, setUserOpen] = useState<boolean | undefined>(undefined)
  const [autoCollapsed, setAutoCollapsed] = useState(false)

  const active = isRunActive(run) || run.status === 'paused'
  const nowMs = useNow(active, now)
  const tree = buildTraceTree(run.steps)
  const header = describeRun(run, tree, t, labels, nowMs)
  const liveLabel = useSettled(header.label, LIVE_REGION_MS)

  useEffect(() => {
    if (run.status !== 'done') return undefined
    const handle = setTimeout(() => setAutoCollapsed(true), AUTO_COLLAPSE_MS)
    return () => clearTimeout(handle)
  }, [run.status])

  if (tree.length === 0 && run.plan === undefined && !active) return null

  const awaiting =
    !isRunFinished(run) && run.steps.some((step) => step.status === 'awaiting_approval')
  const open = userOpen ?? (awaiting || (initialOpen && !autoCollapsed))
  const elapsed =
    active && run.startedAt !== undefined && nowMs !== undefined
      ? formatDuration(Math.max(0, nowMs - run.startedAt))
      : undefined

  return (
    <div className='nxcp-trace' data-status={run.status}>
      <button
        type='button'
        className='nxcp-trace-toggle'
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setUserOpen(!open)}
      >
        <StatusGlyph glyph={header.glyph} label={t(`copilot.run.status.${run.status}`)} />
        <span className='nxcp-trace-label'>{header.label}</span>
        {run.rebuilt ? <span className='nxcp-trace-chip'>{t('copilot.trace.rebuilt')}</span> : null}
        {elapsed === undefined ? null : <span className='nxcp-trace-elapsed'>{elapsed}</span>}
        <span className='nxcp-chevron' aria-hidden='true' />
      </button>
      <span className='nxcp-sr-only' aria-live='polite'>
        {liveLabel}
      </span>
      <div
        id={bodyId}
        className='nxcp-trace-body'
        role='group'
        aria-label={t('copilot.trace.label')}
        hidden={!open}
      >
        {run.plan ? (
          <div className='nxcp-trace-plan'>
            <span className='nxcp-trace-plan-label'>{t('copilot.plan.label')}</span>
            {run.plan.reasoning ? (
              <p className='nxcp-trace-plan-reasoning'>{run.plan.reasoning}</p>
            ) : null}
            {run.plan.lines.length === 0 ? null : (
              <ol className='nxcp-trace-plan-lines'>
                {run.plan.lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
        {tree.length === 0 ? null : <TraceNodes nodes={tree} nowMs={nowMs} />}
      </div>
    </div>
  )
}
