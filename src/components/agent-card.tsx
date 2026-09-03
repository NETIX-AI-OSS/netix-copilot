import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import { agentKey, stepElapsedMs } from '../runtime/trace-model'
import type { PlanStep } from '../types'
import { StatusGlyph, stepGlyph } from './status-glyph'
import { agentDomain, agentLabel, formatDuration } from './trace-labels'

export interface AgentCardProps {
  step: PlanStep
  nowMs?: number
  // The specialist's own tool rows, rendered by the trace so nesting stays in one place.
  children?: ReactNode
}

// The meta-tool name is the surest signal of which specialist this is: `agent` on a delegation
// step may name the caller rather than the callee, depending on which event upserted it.
function specialistName(step: PlanStep): string {
  if (step.tool !== undefined && agentKey(step.tool) !== undefined) return step.tool
  return step.agent ?? step.tool ?? step.title
}

export function AgentCard({ step, nowMs, children }: AgentCardProps): ReactNode {
  const { t, labels } = useCopilotAdapters()
  const name = specialistName(step)
  const domain = agentDomain(agentKey(name) ?? name)
  const label = agentLabel(t, labels, name)
  const elapsed = stepElapsedMs(step, nowMs)

  return (
    <section
      className='nxcp-agent'
      data-domain={domain}
      data-status={step.status}
      aria-label={label}
    >
      <div className='nxcp-agent-head'>
        <StatusGlyph
          glyph={stepGlyph(step.status)}
          label={t(`copilot.step.status.${step.status}`)}
          size={11}
        />
        <span className='nxcp-agent-name'>{label}</span>
        <span className='nxcp-agent-domain'>{t(`copilot.agent.domain.${domain}`)}</span>
        {elapsed === undefined ? null : (
          <span className='nxcp-agent-duration'>{formatDuration(elapsed)}</span>
        )}
      </div>
      {step.task ? (
        <p className='nxcp-agent-task'>
          <span className='nxcp-sr-only'>{t('copilot.agent.task')}: </span>
          {step.task}
        </p>
      ) : null}
      {step.feedback ? (
        <p className='nxcp-agent-feedback'>
          <strong>{t('copilot.agent.refining')}</strong> · {step.feedback}
        </p>
      ) : null}
      {children}
    </section>
  )
}
