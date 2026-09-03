import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { CopilotTurnView } from '../runtime/engine'
import { isRunActive, isRunFinished } from '../runtime/run-store'
import { AnswerActions } from './answer-actions'
import { ApprovalCard } from './approval-card'
import { ArtifactCard } from './artifact-card'
import { Markdown } from './markdown'
import { ReasoningTrace } from './reasoning-trace'
import { hasResultContent, ResultTable } from './result-table'

// The house sparkle, the same path the assistant header uses.
const SPARK = 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z'

export interface MessageViewProps {
  turn: CopilotTurnView
  // Off for a host that renders its own status chips. On by default because dropping the run
  // facts was a visible regression when the first host adopted the SDK.
  showBadges?: boolean
  showResultData?: boolean
}

function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// One prompt and everything the run produced for it: the assistant meta row, the reasoning
// trace, the streaming answer, the artifacts, any approval the backend is waiting on and the
// answer strip.
//
// `turn.prompt` is rendered, never `turn.wirePrompt`: whatever the host appended for the backend
// stays off the screen.
export function MessageView({
  turn,
  showBadges = true,
  showResultData = true,
}: MessageViewProps): ReactNode {
  const { t, renderChart, renderMarkdown } = useCopilotAdapters()
  const { run } = turn
  const streaming = isRunActive(run)
  const approvals = run.steps.filter((step) => step.status === 'awaiting_approval')
  const table = showResultData && run.resultData && hasResultContent(run.resultData)

  return (
    <article className='nxcp-turn'>
      <p className='nxcp-bubble'>{turn.prompt}</p>

      <div className='nxcp-assistant'>
        <div className='nxcp-assistant-meta'>
          <span className='nxcp-avatar' aria-hidden='true'>
            <svg width='12' height='12' viewBox='0 0 24 24' fill='currentColor' focusable='false'>
              <path d={SPARK} />
            </svg>
          </span>
          <span className='nxcp-assistant-name'>{t('copilot.dock.title')}</span>
          {run.modelTier !== undefined && run.modelTier !== 'base' ? (
            <span className='nxcp-assistant-chip' data-tone='tier'>
              {t(`copilot.tier.${run.modelTier}`)}
            </span>
          ) : null}
          <time className='nxcp-assistant-time' dateTime={new Date(turn.createdAt).toISOString()}>
            {formatTime(turn.createdAt)}
          </time>
          {run.status === 'error' ? (
            <span className='nxcp-assistant-chip' data-tone='warning'>
              {t('copilot.status.failed')}
            </span>
          ) : null}
          {run.status === 'cancelled' ? (
            <span className='nxcp-assistant-chip' data-tone='warning'>
              {t('copilot.status.cancelled')}
            </span>
          ) : null}
        </div>

        {run.status === 'queued' ? (
          <p className='nxcp-empty'>
            {run.queuePosition === undefined
              ? t('copilot.status.queued')
              : t('copilot.status.queuedAt', { position: run.queuePosition })}
          </p>
        ) : null}

        <ReasoningTrace run={run} defaultOpen={streaming} />

        {run.text !== '' ? (
          <div className='nxcp-answer'>
            {renderMarkdown ? (
              renderMarkdown(run.text, { streaming })
            ) : (
              <Markdown text={run.text} />
            )}
            {streaming ? <span className='nxcp-caret' aria-hidden='true' /> : null}
          </div>
        ) : null}

        {run.charts.map((chart) => (
          <ArtifactCard key={chart.id} title={chart.title ?? t('copilot.artifact.chart')}>
            <figure className='nxcp-chart'>{renderChart(chart, { height: 280, streaming })}</figure>
          </ArtifactCard>
        ))}

        {table && run.resultData ? (
          <ArtifactCard title={t('copilot.artifact.table')}>
            <ResultTable data={run.resultData} />
          </ArtifactCard>
        ) : null}

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

        {isRunFinished(run) ? <AnswerActions turn={turn} showCaption={showBadges} /> : null}
      </div>
    </article>
  )
}
