import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { CopilotTurnView } from '../runtime/engine'
import { isRunActive } from '../runtime/run-store'
import { ApprovalCard } from './approval-card'
import { Markdown } from './markdown'
import { PlanTimeline } from './plan-timeline'

export interface MessageViewProps {
  turn: CopilotTurnView
}

// One prompt and everything the run produced for it: the step timeline, the streaming answer,
// any charts and any approval the backend is waiting on.
export function MessageView({ turn }: MessageViewProps): ReactNode {
  const { t, renderChart, renderMarkdown } = useCopilotAdapters()
  const { run } = turn
  const streaming = isRunActive(run)
  const approvals = run.steps.filter((step) => step.status === 'awaiting_approval')

  return (
    <article className='nxcp-turn'>
      <p className='nxcp-bubble'>{turn.prompt}</p>

      {run.status === 'queued' ? (
        <p className='nxcp-empty'>
          {run.queuePosition === undefined
            ? t('copilot.status.queued')
            : t('copilot.status.queuedAt', { position: run.queuePosition })}
        </p>
      ) : null}

      <PlanTimeline steps={run.steps} hasPlan={run.hasPlan} />

      {run.text !== '' ? (
        <div className='nxcp-answer'>
          {renderMarkdown ? renderMarkdown(run.text, { streaming }) : <Markdown text={run.text} />}
          {streaming ? <span className='nxcp-caret' aria-hidden='true' /> : null}
        </div>
      ) : null}

      {run.charts.map((chart) => (
        <figure key={chart.id} className='nxcp-chart' style={{ margin: 0 }}>
          {chart.title ? <figcaption className='nxcp-chart-title'>{chart.title}</figcaption> : null}
          {renderChart(chart, { height: 280, streaming })}
        </figure>
      ))}

      {approvals.map((step) => (
        <ApprovalCard key={step.id} step={step} />
      ))}

      {run.status === 'paused' ? (
        <p className='nxcp-banner'>{t('copilot.status.offline')}</p>
      ) : null}

      {run.error ? (
        <p className='nxcp-banner' data-tone='error' role='alert'>
          {run.error.message}
        </p>
      ) : null}

      {run.status === 'cancelled' ? (
        <p className='nxcp-empty'>{t('copilot.status.cancelled')}</p>
      ) : null}

      {streaming && run.text === '' && run.steps.length === 0 && run.status !== 'queued' ? (
        <p className='nxcp-empty'>{t('copilot.status.thinking')}</p>
      ) : null}
    </article>
  )
}
