import type { ReactNode } from 'react'
import { useId, useState } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import { stepElapsedMs } from '../runtime/trace-model'
import type { JsonValue, PlanStep } from '../types'
import { StatusGlyph, stepGlyph } from './status-glyph'
import { formatDuration, toolLabel } from './trace-labels'

const RAW_OUTPUT_CAP = 4000

function rawText(output: JsonValue): string {
  const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
  return text.length > RAW_OUTPUT_CAP ? `${text.slice(0, RAW_OUTPUT_CAP)}…` : text
}

export interface StepRowProps {
  step: PlanStep
  // The trace's shared clock, for a live duration and the approval countdown.
  nowMs?: number
  // Nested rows, when a tool call has children of its own.
  children?: ReactNode
}

// One tool call. The head is a button only when there is something to expand, so a row with no
// detail is plain text rather than a control that does nothing.
export function StepRow({ step, nowMs, children }: StepRowProps): ReactNode {
  const { t, labels } = useCopilotAdapters()
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState(false)
  const detailId = useId()
  const expandable = step.detail !== undefined || step.output !== undefined
  const label = step.tool === undefined ? step.title : toolLabel(t, labels, step.tool, step.status)
  const elapsed = stepElapsedMs(step, nowMs)
  const expiresIn =
    step.status === 'awaiting_approval' && step.expiresAt !== undefined && nowMs !== undefined
      ? Math.max(0, Math.ceil((step.expiresAt - nowMs) / 1000))
      : undefined

  const head = (
    <>
      <StatusGlyph
        glyph={stepGlyph(step.status)}
        label={t(`copilot.step.status.${step.status}`)}
        size={11}
      />
      <span className='nxcp-row-label'>{label}</span>
      {step.argsSummary ? <span className='nxcp-row-args'>{step.argsSummary}</span> : null}
      {expiresIn === undefined ? null : (
        <span className='nxcp-row-expires'>
          {t('copilot.trace.expiresIn', { seconds: expiresIn })}
        </span>
      )}
      {elapsed === undefined ? null : (
        <span className='nxcp-row-duration'>{formatDuration(elapsed)}</span>
      )}
      {expandable ? <span className='nxcp-chevron' aria-hidden='true' /> : null}
    </>
  )

  return (
    <li className='nxcp-trace-node nxcp-row' data-kind='tool' data-status={step.status}>
      {expandable ? (
        <button
          type='button'
          className='nxcp-row-head'
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpen((current) => !current)}
        >
          {head}
        </button>
      ) : (
        <div className='nxcp-row-head'>{head}</div>
      )}
      {expandable ? (
        <div id={detailId} className='nxcp-row-detail' hidden={!open}>
          {step.detail ? <p className='nxcp-row-detail-text'>{step.detail}</p> : null}
          {step.output === undefined ? null : (
            <>
              <button
                type='button'
                className='nxcp-row-raw-toggle'
                aria-pressed={raw}
                onClick={() => setRaw((current) => !current)}
              >
                {t(raw ? 'copilot.trace.hideRaw' : 'copilot.trace.showRaw')}
              </button>
              {raw ? <pre className='nxcp-row-raw'>{rawText(step.output)}</pre> : null}
            </>
          )}
        </div>
      ) : null}
      {children}
    </li>
  )
}
