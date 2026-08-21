import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { TransportName } from '../transport/types'
import type { CopilotUsage } from '../types'

export interface UsageFooterProps {
  usage?: CopilotUsage
  transport?: TransportName
  model?: string
}

// Every figure here is conditional, including the credit balance. ml-engine returns
// credits_remaining inside `usage` on both the SSE event and the REST payload, computed live from
// UserMLConfiguration and deliberately not persisted -- so it is present on a fresh answer and
// absent on a replayed one. Absent means unknown, which is why it hides rather than showing zero.
export function UsageFooter({ usage, transport, model }: UsageFooterProps): ReactNode {
  const { t } = useCopilotAdapters()
  const items: string[] = []

  if (model) items.push(model)
  if (usage?.tokensIn !== undefined || usage?.tokensOut !== undefined) {
    items.push(
      t('copilot.usage.tokens', {
        in: usage.tokensIn ?? 0,
        out: usage.tokensOut ?? 0,
      }),
    )
  }
  if (usage?.calls !== undefined) items.push(t('copilot.usage.calls', { count: usage.calls }))
  if (usage?.costUsd !== undefined) items.push(`$${usage.costUsd.toFixed(4)}`)
  if (usage?.creditsRemaining !== undefined) {
    items.push(t('copilot.usage.credits', { count: usage.creditsRemaining }))
  }

  if (items.length === 0 && transport === undefined) return null

  return (
    <footer className='nxcp-footer'>
      {items.map((item) => (
        <span key={item} className='nxcp-usage-item'>
          {item}
        </span>
      ))}
      {transport ? (
        <span className='nxcp-usage-item' style={{ marginLeft: 'auto' }} data-transport={transport}>
          {t(`copilot.transport.${transport}`)}
        </span>
      ) : null}
    </footer>
  )
}
