import type { KeyboardEvent, ReactNode } from 'react'

import { useCopilotAdapters, useCopilotModelTier } from '../adapters/context'
import { MODEL_TIERS, type ModelTier } from '../types'

export interface ModelTierSelectorProps {
  className?: string
}

export function ModelTierSelector({ className }: ModelTierSelectorProps): ReactNode {
  const { t } = useCopilotAdapters()
  const { tier, locked, setTier } = useCopilotModelTier()

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const current = MODEL_TIERS.findIndex((entry) => entry.key === tier)
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    const next = MODEL_TIERS[(current + delta + MODEL_TIERS.length) % MODEL_TIERS.length]
    if (next) setTier(next.key)
  }

  return (
    <div
      className={`nxcp-tier-selector${className ? ` ${className}` : ''}`}
      role='radiogroup'
      aria-label={t('copilot.tier.label')}
      aria-disabled={locked}
      data-locked={locked ? 'true' : 'false'}
      onKeyDown={move}
    >
      {MODEL_TIERS.map((entry) => (
        <label key={entry.key} className='nxcp-tier-option' data-selected={tier === entry.key}>
          <input
            className='nxcp-tier-input'
            type='radio'
            name='nxcp-model-tier'
            value={entry.key}
            checked={tier === entry.key}
            disabled={locked}
            tabIndex={tier === entry.key ? 0 : -1}
            onChange={() => setTier(entry.key as ModelTier)}
          />
          <span className='nxcp-tier-name'>{entry.label.split(' ')[0]}</span>
          <span className='nxcp-tier-badge'>{entry.multiplier}x</span>
        </label>
      ))}
      {locked ? <span className='nxcp-tier-lock'>{t('copilot.tier.locked')}</span> : null}
    </div>
  )
}
