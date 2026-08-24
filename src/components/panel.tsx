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
import { MessageView } from './message-view'
import { ThreadList } from './thread-list'
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
  renderTurn?: (turn: CopilotTurnView, defaultView: ReactNode) => ReactNode
}

export function CopilotPanel({
  title,
  headerActions,
  footerActions,
  emptyState,
  quickPrompts = [],
  showThreads = false,
  autoFocus,
  className,
  renderTurn,
}: CopilotPanelProps): ReactNode {
  const { t, theme } = useCopilotAdapters()
  const engine = useCopilotEngine()
  const send = useCopilotSend()
  const state = useCopilotState()
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const run = state.turns[state.turns.length - 1]?.run
  const busy = state.sending || (run !== undefined && isRunActive(run))

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
    >
      <header className='nxcp-header'>
        <span className='nxcp-title'>{title ?? t('copilot.dock.title')}</span>
        {headerActions}
        <button
          type='button'
          className='nxcp-icon-button'
          onClick={() => engine.startNewThread()}
          disabled={busy}
        >
          {t('copilot.dock.new')}
        </button>
      </header>
      {!state.online ? <div className='nxcp-banner'>{t('copilot.status.offline')}</div> : null}
      {showThreads ? <ThreadList /> : null}
      <div className='nxcp-body' ref={bodyRef}>
        {state.threadLoading ? (
          <p className='nxcp-empty'>{t('copilot.threads.restoring')}</p>
        ) : state.turns.length === 0 ? (
          <div className='nxcp-empty-state'>
            {emptyState ?? <p className='nxcp-empty'>{t('copilot.dock.empty')}</p>}
            {quickPrompts.length > 0 ? (
              <div className='nxcp-quick-prompts'>
                {quickPrompts.map((prompt) => (
                  <button key={prompt} type='button' onClick={() => send(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
    </section>
  )
}
