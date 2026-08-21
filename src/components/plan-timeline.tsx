import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { PlanStep } from '../types'

function formatDuration(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export interface PlanTimelineProps {
  steps: PlanStep[]
  // True when the backend sent a plan event. A run without one is normal, not an error: the
  // direct router answers single-domain prompts without ever consulting the orchestrator.
  hasPlan: boolean
}

export function PlanTimeline({ steps, hasPlan }: PlanTimelineProps): ReactNode {
  const { t } = useCopilotAdapters()
  if (steps.length === 0) return null

  return (
    <div className='nxcp-timeline'>
      <span className='nxcp-sr-only'>
        {hasPlan ? t('copilot.plan.label') : t('copilot.steps.label')}
      </span>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'contents' }}>
        {steps.map((step) => {
          const duration = formatDuration(step.durationMs)
          return (
            <li key={step.id} className='nxcp-step'>
              <span className='nxcp-dot' data-status={step.status} aria-hidden='true' />
              <span className='nxcp-step-tool'>{step.tool ?? step.title}</span>
              {step.argsSummary ? <span className='nxcp-step-args'>{step.argsSummary}</span> : null}
              {duration ? <span className='nxcp-step-duration'>{duration}</span> : null}
              <span className='nxcp-sr-only'>{t(`copilot.step.status.${step.status}`)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
