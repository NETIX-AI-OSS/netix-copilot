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
      <div>
        <strong>{step.title}</strong>
        {step.argsSummary ? <div className='nxcp-step-args'>{step.argsSummary}</div> : null}
      </div>
      {failure ? (
        <div className='nxcp-banner' data-tone='error'>
          {failure}
        </div>
      ) : null}
      <div className='nxcp-approval-actions'>
        <button type='button' className='nxcp-send' disabled={pending} onClick={() => decide(true)}>
          {t('copilot.approval.approve')}
        </button>
        <button
          type='button'
          className='nxcp-icon-button'
          disabled={pending}
          onClick={() => decide(false)}
        >
          {t('copilot.approval.reject')}
        </button>
      </div>
    </section>
  )
}
