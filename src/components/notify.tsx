// One way to say "done" after a small action: copied, exported, deleted. A host with its own
// toaster supplies `adapters.notify`; otherwise the SDK's bottom-centre pill (toast-pill.tsx)
// shows it.

import { useCallback } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { CopilotNotification } from '../adapters/types'

// A toast carrying an action needs time to read and reach; a plain confirmation does not.
const ACTION_TIMEOUT_MS = 5200
const PLAIN_TIMEOUT_MS = 3000

export interface NotificationSnapshot {
  current: CopilotNotification | undefined
}

const listeners = new Set<() => void>()
let snapshot: NotificationSnapshot = { current: undefined }
let timer: ReturnType<typeof setTimeout> | undefined

function emit(current: CopilotNotification | undefined): void {
  snapshot = { current }
  for (const listener of listeners) listener()
}

// Module-level so the pill can sit anywhere in the tree and a notification raised before it
// mounts is still the one it shows. One slot and one timer: a new toast replaces the old.
export const notificationStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): NotificationSnapshot {
    return snapshot
  },
  show(notification: CopilotNotification): void {
    if (timer !== undefined) clearTimeout(timer)
    emit(notification)
    timer = setTimeout(
      () => notificationStore.dismiss(),
      notification.action ? ACTION_TIMEOUT_MS : PLAIN_TIMEOUT_MS,
    )
  },
  dismiss(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (snapshot.current !== undefined) emit(undefined)
  },
}

let fallbackNotify: (notification: CopilotNotification) => void = notificationStore.show

export function setFallbackNotify(notify: (notification: CopilotNotification) => void): void {
  fallbackNotify = notify
}

export function useNotify(): (notification: CopilotNotification) => void {
  const { notify } = useCopilotAdapters()
  return useCallback(
    (notification: CopilotNotification) => (notify ?? fallbackNotify)(notification),
    [notify],
  )
}
