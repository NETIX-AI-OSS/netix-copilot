import type { ReactNode } from 'react'

import { useCopilotAdapters, useCopilotState } from '../adapters/context'
import type { CopilotTurnView } from '../runtime/engine'
import { isRunActive, isRunFinished } from '../runtime/run-store'
import { AnswerActions } from './answer-actions'
import { AnswerBlocks } from './answer-blocks'
import { ApprovalCard } from './approval-card'
import { ArtifactCard } from './artifact-card'
import { Markdown } from './markdown'
import { ReasoningTrace } from './reasoning-trace'
import { hasResultContent, ResultTable } from './result-table'

export interface MessageViewProps {
  turn: CopilotTurnView
  // Off for a host that renders its own status chips. On by default because dropping the run
  // facts was a visible regression when the first host adopted the SDK.
  showBadges?: boolean
  showResultData?: boolean
}

// One prompt and everything the run produced for it: any status chips, the reasoning
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
  const { threadReadOnly } = useCopilotState()
  const { run } = turn
  const streaming = isRunActive(run)
  const approvals = threadReadOnly
    ? []
    : run.steps.filter((step) => step.status === 'awaiting_approval')
  const table = showResultData && run.resultData && hasResultContent(run.resultData)
  // Only what a reader needs to know about the run: a non-default tier or how it ended. Who
  // answered and when needs no header row; the time sits in the answer strip.
  const chips: { key: string; tone: 'tier' | 'warning'; label: string }[] = []
  if (run.modelTier !== undefined && run.modelTier !== 'base') {
    chips.push({ key: 'tier', tone: 'tier', label: t(`copilot.tier.${run.modelTier}`) })
  }
  if (run.status === 'error') {
    chips.push({ key: 'error', tone: 'warning', label: t('copilot.status.failed') })
  }
  if (run.status === 'cancelled') {
    chips.push({ key: 'cancelled', tone: 'warning', label: t('copilot.status.cancelled') })
  }

  return (
    <article className='nxcp-turn'>
      <p className='nxcp-bubble'>{turn.prompt}</p>

      <div className='nxcp-assistant'>
        {chips.length > 0 ? (
          <div className='nxcp-assistant-meta'>
            {chips.map((chip) => (
              <span key={chip.key} className='nxcp-assistant-chip' data-tone={chip.tone}>
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}

        <ReasoningTrace run={run} defaultOpen={streaming} />

        {run.text !== '' ? (
          <AnswerBlocks>
            {renderMarkdown ? (
              <>
                {renderMarkdown(run.text, { streaming })}
                {streaming ? <span className='nxcp-caret' aria-hidden='true' /> : null}
              </>
            ) : (
              <Markdown text={run.text} streaming={streaming} />
            )}
          </AnswerBlocks>
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

        {run.cancellation?.status === 'requested' ? (
          <p className='nxcp-banner'>{t('copilot.status.cancelling')}</p>
        ) : null}

        {run.cancellation?.status === 'failed' ? (
          <p className='nxcp-banner' data-tone='error' role='alert'>
            {run.cancellation.message ?? t('copilot.status.cancelFailed')}
          </p>
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
