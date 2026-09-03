import type { ReactNode } from 'react'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import { notificationStore } from './notify'

// A global dock and an embedded panel can be mounted at once, and each carries a ToastHost.
// Only the first mounted one paints, so a notification never shows twice.
const hostIds: number[] = []
const hostListeners = new Set<() => void>()
let hostSeq = 0

function subscribeHosts(listener: () => void): () => void {
  hostListeners.add(listener)
  return () => {
    hostListeners.delete(listener)
  }
}

function useIsPrimaryHost(): boolean {
  const [id] = useState(() => {
    hostSeq += 1
    return hostSeq
  })
  useEffect(() => {
    hostIds.push(id)
    for (const listener of hostListeners) listener()
    return () => {
      hostIds.splice(hostIds.indexOf(id), 1)
      for (const listener of hostListeners) listener()
    }
  }, [id])
  return useSyncExternalStore(
    subscribeHosts,
    () => hostIds[0] === id,
    () => false,
  )
}

export function ToastHost(): ReactNode {
  const { t } = useCopilotAdapters()
  const { current } = useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getSnapshot,
    notificationStore.getSnapshot,
  )
  const primary = useIsPrimaryHost()
  if (!primary) return null
  const action = current?.action

  // The live region stays mounted while empty, or assistive tech never hears the first toast. It
  // carries no role of its own, so an empty region is not a status widget a host waits on.
  return (
    <div className='nxcp-toast-region' aria-live='polite' aria-atomic='true'>
      {current ? (
        <div className='nxcp-toast' role='status' data-tone={current.tone ?? 'info'}>
          <span>{current.message}</span>
          {action ? (
            <button
              type='button'
              className='nxcp-toast-action'
              onClick={() => {
                action.onSelect()
                notificationStore.dismiss()
              }}
            >
              {action.label}
            </button>
          ) : null}
          <button
            type='button'
            className='nxcp-toast-dismiss'
            aria-label={t('copilot.toast.dismiss')}
            onClick={() => notificationStore.dismiss()}
          >
            <svg
              width={12}
              height={12}
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2.4}
              aria-hidden='true'
            >
              <path d='M6 6l12 12M18 6L6 18' />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  )
}
