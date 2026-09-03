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
import { EmptyState, SparkIcon } from './empty-state'
import { ThreadsPopover } from './history-rail'
import { MessageView } from './message-view'
import { ToastHost } from './toast-pill'
import { UsageFooter } from './usage-footer'

export interface CopilotPanelProps {
  title?: ReactNode
  headerActions?: ReactNode
  footerActions?: ReactNode
  emptyState?: ReactNode
  quickPrompts?: readonly string[]
  showThreads?: boolean
  autoFocus?: boolean
  className?: string
  // In the dock, conversations live in a header popover. In full mode the host places
  // HistoryRail beside the panel, so nothing about threads renders here.
  layout?: 'dock' | 'full'
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
    if (distance < 140) node.scrollTop = node.scrollHeight
  }, [run?.text.length, state.turns.length])

  return (
    <section
      className={`nxcp-root nxcp-panel${className ? ` ${className}` : ''}`}
      style={themeToCssVars(theme)}
      data-streaming={busy ? 'true' : 'false'}
      data-layout={layout}
    >
      <header className='nxcp-header'>
        <span className='nxcp-title'>
          <SparkIcon size={14} />
          {title ?? t('copilot.dock.title')}
        </span>
        {layout === 'full' ? (
          <span className='nxcp-caption'>{t('copilot.dock.caption')}</span>
        ) : null}
        <span className='nxcp-header-actions'>
          {showThreads && layout === 'dock' ? <ThreadsPopover /> : null}
          <button
            type='button'
            className='nxcp-icon-button'
            aria-label={t('copilot.dock.new')}
            title={t('copilot.dock.new')}
            onClick={() => engine.startNewThread()}
            disabled={busy}
          >
            <svg
              width={13}
              height={13}
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2.4}
              aria-hidden='true'
            >
              <path d='M12 5v14M5 12h14' />
            </svg>
          </button>
          {headerActions}
        </span>
      </header>
      {!state.online ? <div className='nxcp-banner'>{t('copilot.status.offline')}</div> : null}
      <div className='nxcp-body' ref={bodyRef}>
        {state.threadLoading ? (
          <p className='nxcp-empty'>{t('copilot.threads.restoring')}</p>
        ) : state.turns.length === 0 ? (
          <EmptyState
            heading={emptyState ?? t('copilot.dock.title')}
            body={t('copilot.dock.empty')}
            chips={chips}
            onSelect={send}
          />
        ) : (
          state.turns.map((turn) => {
            const view = <MessageView key={turn.id} turn={turn} />
            return renderTurn ? <div key={turn.id}>{renderTurn(turn, view)}</div> : view
          })
        )}
      </div>
      <Composer autoFocus={autoFocus} />
      <UsageFooter usage={run?.usage} transport={state.transport} modelTier={state.modelTier} />
      {footerActions ? <div className='nxcp-footer-actions'>{footerActions}</div> : null}
      <ToastHost />
    </section>
  )
}
