import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import {
  useCopilotAdapters,
  useCopilotEngine,
  useCopilotSend,
  useCopilotState,
} from '../adapters/context'
import type { CopilotPageContext } from '../adapters/types'
import { isRunActive } from '../runtime/run-store'
import { ModelTierSelector } from './model-tier-selector'

const MAX_TEXTAREA_HEIGHT = 120

export interface ComposerProps {
  autoFocus?: boolean
}

// What the context chip names: the record on screen when there is one, else the host module.
function contextLabel(pageContext: CopilotPageContext): string | undefined {
  const { entity, state } = pageContext
  if (entity) return entity.label ?? `${entity.type} ${entity.id}`
  return typeof state?.module === 'string' ? state.module : undefined
}

export function Composer({ autoFocus }: ComposerProps): ReactNode {
  const { t, pageContext } = useCopilotAdapters()
  const send = useCopilotSend()
  const engine = useCopilotEngine()
  const state = useCopilotState()
  const [value, setValue] = useState('')
  const boxRef = useRef<HTMLTextAreaElement | null>(null)

  const run = state.turns[state.turns.length - 1]?.run
  const busy = state.sending || (run !== undefined && isRunActive(run))
  const canSend = value.trim() !== '' && !busy && state.online
  const label = contextLabel(pageContext)

  // Grows with the draft up to a ceiling; the stylesheet's min-height keeps an empty box open.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [value])

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
        {label !== undefined ? (
          <button
            type='button'
            className='nxcp-context-chip'
            data-state={state.contextEnabled ? 'on' : 'off'}
            aria-pressed={state.contextEnabled}
            aria-label={t('copilot.composer.context', { label })}
            title={
              state.contextEnabled
                ? t('copilot.composer.contextOn')
                : t('copilot.composer.contextOff')
            }
            onClick={() => engine.setContextEnabled(!state.contextEnabled)}
          >
            <span className='nxcp-context-chip-label' dir='ltr'>
              @{label}
            </span>
          </button>
        ) : null}
        <textarea
          ref={boxRef}
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
              <button
                type='button'
                className='nxcp-send'
                data-busy='true'
                onClick={() => engine.cancel()}
              >
                {t('copilot.composer.stop')}
              </button>
            ) : (
              <button type='button' className='nxcp-send' disabled={!canSend} onClick={submit}>
                {t('copilot.composer.send')}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className='nxcp-composer-meta'>
        <span>{t('copilot.composer.disclaimer')}</span>
        <span>{t('copilot.composer.hint')}</span>
      </div>
    </div>
  )
}
