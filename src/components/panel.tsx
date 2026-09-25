import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

import {
  useCopilotAdapters,
  useCopilotEngine,
  useCopilotSend,
  useCopilotState,
} from '../adapters/context'
import type { CopilotTurnView } from '../runtime/engine'
import { isRunActive } from '../runtime/run-store'
import { injectCopilotStyles } from '../ui/styles'
import { themeToCssVars } from '../ui/theme'
import { Composer } from './composer'
import { EmptyState, QuickPrompts } from './empty-state'
import { ThreadsPopover } from './history-rail'
import { MessageView } from './message-view'
import { ToastHost } from './toast-pill'

export interface CopilotPanelProps {
  title?: ReactNode
  headerActions?: ReactNode
  footerActions?: ReactNode
  emptyState?: ReactNode
  quickPrompts?: readonly string[]
  showThreads?: boolean
  autoFocus?: boolean
  className?: string
  // In the dock, conversations live in a header popover. Expanded (the dock's own large view)
  // and full (a host page) place HistoryRail beside the panel, so no popover renders there.
  layout?: 'dock' | 'expanded' | 'full'
  renderTurn?: (turn: CopilotTurnView, defaultView: ReactNode) => ReactNode
}

export function CopilotPanel({
  title,
  headerActions,
  footerActions,
  emptyState,
  quickPrompts,
  showThreads = false,
  autoFocus,
  className,
  layout = 'dock',
  renderTurn,
}: CopilotPanelProps): ReactNode {
  const adapters = useCopilotAdapters()
  const { t, theme } = adapters
  const engine = useCopilotEngine()
  const send = useCopilotSend()
  const state = useCopilotState()
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const run = state.turns[state.turns.length - 1]?.run
  const busy = state.sending || (run !== undefined && isRunActive(run))
  const chips = quickPrompts ?? adapters.quickPrompts ?? []

  useEffect(() => injectCopilotStyles(), [])
  useEffect(() => {
    const node = bodyRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    if (distance < 160) node.scrollTop = node.scrollHeight
  }, [run?.text.length, run?.steps.length, run?.status, state.turns.length])

  return (
    <section
      className={`nxcp-root nxcp-panel${className ? ` ${className}` : ''}`}
      style={themeToCssVars(theme)}
      data-streaming={busy ? 'true' : 'false'}
      data-layout={layout}
    >
      <header className='nxcp-header'>
        <span className='nxcp-title'>
          <span className='nxcp-title-text'>{title ?? t('copilot.dock.title')}</span>
        </span>
        <span className='nxcp-header-actions'>
          {showThreads && layout !== 'full' ? <ThreadsPopover /> : null}
          <button
            type='button'
            className='nxcp-icon-button nxcp-header-new'
            aria-label={t('copilot.dock.new')}
            title={t('copilot.dock.new')}
            onClick={() => engine.startNewThread()}
            disabled={busy || state.turns.length === 0}
          >
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
              <path d='M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6' />
              <path d='M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z' />
            </svg>
          </button>
          {headerActions}
        </span>
      </header>
      {!state.online ? <div className='nxcp-banner'>{t('copilot.status.offline')}</div> : null}
      <div className='nxcp-body' ref={bodyRef}>
        <div className='nxcp-body-inner'>
          {state.threadLoading ? (
            <p className='nxcp-empty'>{t('copilot.threads.restoring')}</p>
          ) : state.turns.length === 0 ? (
            emptyState === undefined ? (
              <EmptyState
                heading={t('copilot.dock.title')}
                body={t('copilot.dock.empty')}
                chips={chips}
                onSelect={send}
              />
            ) : (
              // A host placeholder stands in for the whole default block, as it did in v0.3.
              <div className='nxcp-empty-state'>
                {emptyState}
                <QuickPrompts chips={chips} onSelect={send} />
              </div>
            )
          ) : (
            state.turns.map((turn) => {
              const view = <MessageView key={turn.id} turn={turn} />
              return renderTurn ? <div key={turn.id}>{renderTurn(turn, view)}</div> : view
            })
          )}
        </div>
      </div>
      <Composer
        autoFocus={autoFocus}
        meta={footerActions ? <div className='nxcp-footer-actions'>{footerActions}</div> : null}
      />
      <ToastHost />
    </section>
  )
}
