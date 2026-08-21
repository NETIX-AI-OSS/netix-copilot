import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { RunState } from '../types'

export interface RunBadgesProps {
  run: RunState
}

function formatSeconds(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
}

// The status, timing and tool chips the per-app drawers showed under every answer. They are the
// only evidence a user has that a slow turn was actually working, so an adopting host should not
// have to rebuild them.
export function RunBadges({ run }: RunBadgesProps): ReactNode {
  const { t } = useCopilotAdapters()
  const showStatus = run.status !== 'idle' && run.status !== 'creating'
  // Timing is only meaningful once the run stopped; mid-run it would tick a stale number.
  const showDuration =
    run.executionMs !== undefined &&
    (run.status === 'done' || run.status === 'error' || run.status === 'cancelled')
  const tools = run.tools ?? []

  if (!showStatus && !showDuration && tools.length === 0) return null

  return (
    <div className='nxcp-badges'>
      {showStatus ? (
        <span className='nxcp-badge' data-run-status={run.status}>
          {t(`copilot.run.status.${run.status}`)}
        </span>
      ) : null}
      {showDuration && run.executionMs !== undefined ? (
        <span className='nxcp-badge'>{formatSeconds(run.executionMs)}</span>
      ) : null}
      {tools.map((tool) => (
        <span key={tool} className='nxcp-badge' data-tone='tool'>
          {tool}
        </span>
      ))}
    </div>
  )
}
