// One way to say "done" after a small action: copied, exported, deleted. A host with its own
// toaster supplies `adapters.notify`; otherwise the SDK's bottom-centre pill (toast-pill.tsx)
// shows it.

import { useCallback } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import type { CopilotNotification } from '../adapters/types'

// Placeholder until the in-SDK toast pill lands: without a host notifier a notification is
// dropped rather than thrown, so an action never fails because its confirmation could not show.
let fallbackNotify: (notification: CopilotNotification) => void = () => {}

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
