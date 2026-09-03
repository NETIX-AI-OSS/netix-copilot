import type { ReactNode } from 'react'

import { HistoryRail } from './history-rail'

export interface ThreadListProps {
  // Loading the list is a plain GET, so it is safe on mount; it opens no stream.
  autoLoad?: boolean
}

// Kept for hosts on the v0.3 API: the compact rail is what the old thread strip became.
export function ThreadList({ autoLoad = true }: ThreadListProps): ReactNode {
  return <HistoryRail compact autoLoad={autoLoad} />
}
