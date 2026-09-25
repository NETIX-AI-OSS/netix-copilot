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
import { TierMenu, UsageMeter } from './run-menu'

const MAX_TEXTAREA_HEIGHT = 180

export interface ComposerProps {
  autoFocus?: boolean
  // Host facts (e.g. "Powered by …") for the quiet line under the card.
  meta?: ReactNode
}

// Anything that is its own control keeps its click; the rest of the card focuses the box.
const OWN_CLICK = 'button, select, a, input, textarea, label, [role="dialog"]'

// What the context chip names: the record on screen when there is one, else the host module.
function contextLabel(pageContext: CopilotPageContext): string | undefined {
  const { entity, state } = pageContext
  if (entity) return entity.label ?? `${entity.type} ${entity.id}`
  return typeof state?.module === 'string' ? state.module : undefined
}

export function Composer({ autoFocus, meta }: ComposerProps): ReactNode {
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

  if (state.threadReadOnly) {
    return <p className='nxcp-banner'>{t('copilot.thread.readOnly')}</p>
  }

  const submit = () => {
    if (!canSend) return
    send(value)
    setValue('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line, matching the drawers this replaces.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const stopping = run?.cancellation?.status === 'requested'

  return (
    <div className='nxcp-compose-shell'>
      {state.turns.length === 0 ? (
        // Said once, before the first question; a conversation in progress needs no reminder.
        <p className='nxcp-disclaimer'>
          <svg
            width={14}
            height={14}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
          >
            <circle cx={12} cy={12} r={9.5} />
            <path d='M12 11v5.5M12 7.6v.1' />
          </svg>
          <span>{t('copilot.composer.disclaimer')}</span>
        </p>
      ) : null}
      <div
        className='nxcp-composer'
        onMouseDown={(event) => {
          // The whole card is the target: a press on its padding or the empty toolbar still lands
          // in the box, with the caret at the end, and never steals focus from a real control.
          if ((event.target as Element).closest(OWN_CLICK)) return
          event.preventDefault()
          const box = boxRef.current
          if (!box) return
          box.focus()
          box.setSelectionRange(box.value.length, box.value.length)
        }}
      >
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
          <TierMenu />
          <div className='nxcp-composer-actions'>
            <UsageMeter />
            {busy ? (
              <button
                type='button'
                className='nxcp-send'
                data-busy='true'
                aria-label={stopping ? t('copilot.composer.stopping') : t('copilot.composer.stop')}
                title={stopping ? t('copilot.composer.stopping') : t('copilot.composer.stop')}
                disabled={stopping}
                onClick={() => engine.cancel()}
              >
                <svg width={10} height={10} viewBox='0 0 10 10' aria-hidden='true'>
                  <rect width={10} height={10} rx={2} fill='currentColor' />
                </svg>
              </button>
            ) : (
              <button
                type='button'
                className='nxcp-send'
                aria-label={t('copilot.composer.send')}
                title={t('copilot.composer.send')}
                disabled={!canSend}
                onClick={submit}
              >
                <svg
                  width={16}
                  height={16}
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2.4}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  aria-hidden='true'
                >
                  <path d='M12 19V5M5 12l7-7 7 7' />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      {meta ? <div className='nxcp-compose-foot'>{meta}</div> : null}
    </div>
  )
}
