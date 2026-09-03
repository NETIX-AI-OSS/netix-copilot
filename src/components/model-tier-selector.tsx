import type { ChangeEvent, ReactNode } from 'react'

import { useCopilotAdapters, useCopilotModelTier } from '../adapters/context'
import { MODEL_TIERS, type ModelTier } from '../types'

export interface ModelTierSelectorProps {
  className?: string
}

export function ModelTierSelector({ className }: ModelTierSelectorProps): ReactNode {
  const { t } = useCopilotAdapters()
  const { tier, locked, setTier } = useCopilotModelTier()

  const changeTier = (event: ChangeEvent<HTMLSelectElement>) => {
    setTier(event.target.value as ModelTier)
  }

  return (
    <label
      className={`nxcp-tier-selector${className ? ` ${className}` : ''}`}
      data-locked={locked ? 'true' : 'false'}
      title={locked ? t('copilot.tier.locked') : t('copilot.tier.label')}
    >
      <span className='nxcp-tier-orb' aria-hidden='true' />
      <span className='nxcp-sr-only'>{t('copilot.tier.label')}</span>
      <select
        className='nxcp-tier-select'
        aria-label={t('copilot.tier.label')}
        value={tier}
        disabled={locked}
        onChange={changeTier}
      >
        {MODEL_TIERS.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {t(`copilot.tier.${entry.key}`)}
          </option>
        ))}
      </select>
      <span className='nxcp-tier-chevron' aria-hidden='true' />
    </label>
  )
}
