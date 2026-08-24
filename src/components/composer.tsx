import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import { useState } from 'react'

import { useCopilotAdapters, useCopilotSend, useCopilotState } from '../adapters/context'
import { useCopilotEngine } from '../adapters/context'
import { isRunActive } from '../runtime/run-store'
import { ModelTierSelector } from './model-tier-selector'

export interface ComposerProps {
  autoFocus?: boolean
}

export function Composer({ autoFocus }: ComposerProps): ReactNode {
  const { t } = useCopilotAdapters()
  const send = useCopilotSend()
  const engine = useCopilotEngine()
  const state = useCopilotState()
  const [value, setValue] = useState('')

  const run = state.turns[state.turns.length - 1]?.run
  const busy = state.sending || (run !== undefined && isRunActive(run))
  const canSend = value.trim() !== '' && !busy && state.online

  const submit = () => {
    if (!canSend) return
    send(value)
    setValue('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line, matching the drawers this replaces.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className='nxcp-compose-shell'>
      <div className='nxcp-composer'>
        <textarea
          className='nxcp-textarea'
          value={value}
          rows={1}
          autoFocus={autoFocus}
          placeholder={
            state.online ? t('copilot.composer.placeholder') : t('copilot.status.offline')
          }
          aria-label={t('copilot.composer.label')}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className='nxcp-composer-toolbar'>
          <ModelTierSelector />
          <div className='nxcp-composer-actions'>
            {busy ? (
              <button type='button' className='nxcp-icon-button' onClick={() => engine.cancel()}>
                {t('copilot.composer.stop')}
              </button>
            ) : null}
            <button type='button' className='nxcp-send' disabled={!canSend} onClick={submit}>
              {t('copilot.composer.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
