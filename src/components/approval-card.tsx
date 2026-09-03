import type { ReactNode } from 'react'
import { useState } from 'react'

import { useCopilotAdapters, useCopilotEngine } from '../adapters/context'
import type { PlanStep } from '../types'

export interface ApprovalCardProps {
  step: PlanStep
}

// Rendered for any step the backend parks in `awaiting_approval`. The decision goes back over
// the transport, which only the streaming contract implements; the poll transport rejects it
// loudly rather than pretending the approval was recorded.
export function ApprovalCard({ step }: ApprovalCardProps): ReactNode {
  const { t } = useCopilotAdapters()
  const engine = useCopilotEngine()
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  const decide = (approved: boolean) => {
    setPending(true)
    setFailure(undefined)
    engine
      .approve(step.id, approved)
      .catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : t('copilot.approval.failed'))
      })
      .finally(() => setPending(false))
  }

  return (
    <section className='nxcp-approval' aria-label={t('copilot.approval.label')}>
      <div className='nxcp-approval-head'>
        <span className='nxcp-approval-glyph' aria-hidden='true'>
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            focusable='false'
          >
            <path d='M12 2l8 3v6c0 5.2-3.4 9.6-8 11-4.6-1.4-8-5.8-8-11V5l8-3z' />
            <path d='M9 12l2 2 4-4' />
          </svg>
        </span>
        <div className='nxcp-approval-body'>
          <strong className='nxcp-approval-title'>{step.title}</strong>
          {step.argsSummary ? <code className='nxcp-approval-args'>{step.argsSummary}</code> : null}
          {step.detail ? <p className='nxcp-approval-detail'>{step.detail}</p> : null}
        </div>
      </div>
      {failure ? (
        <div className='nxcp-banner' data-tone='error'>
          {failure}
        </div>
      ) : null}
      <div className='nxcp-approval-actions'>
        <button
          type='button'
          className='nxcp-approval-button'
          data-variant='approve'
          disabled={pending}
          onClick={() => decide(true)}
        >
          {t('copilot.approval.approve')}
        </button>
        <button
          type='button'
          className='nxcp-approval-button'
          data-variant='reject'
          disabled={pending}
          onClick={() => decide(false)}
        >
          {t('copilot.approval.reject')}
        </button>
      </div>
    </section>
  )
}
