import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { useCopilotAdapters, useCopilotEngine, useCopilotState } from '../adapters/context'

export interface ThreadListProps {
  // Loading the list is a plain GET, so it is safe on mount; it opens no stream.
  autoLoad?: boolean
}

export function ThreadList({ autoLoad = true }: ThreadListProps): ReactNode {
  const { t } = useCopilotAdapters()
  const engine = useCopilotEngine()
  const state = useCopilotState()

  useEffect(() => {
    if (!autoLoad || state.threadsLoaded) return
    void engine.loadThreads()
  }, [autoLoad, engine, state.threadsLoaded])

  if (!state.threadsLoaded) {
    return <div className='nxcp-empty'>{t('copilot.threads.loading')}</div>
  }
  if (state.threads.length === 0) {
    return <div className='nxcp-empty'>{t('copilot.threads.empty')}</div>
  }

  return (
    <nav className='nxcp-threads' aria-label={t('copilot.threads.label')}>
      {state.threads.map((thread) => (
        <button
          key={thread.id}
          type='button'
          className='nxcp-thread'
          aria-current={thread.id === state.threadId ? 'true' : 'false'}
          onClick={() => engine.selectThread(thread.id)}
        >
          <span className='nxcp-thread-title'>{thread.title}</span>
        </button>
      ))}
    </nav>
  )
}
