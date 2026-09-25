import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  useCopilotAdapters,
  useCopilotEnabled,
  useCopilotEngine,
  useCopilotState,
} from '../adapters/context'
import { COPILOT_URL_PARAMS, type CopilotUrlState, isUrlOpen, readUrlThread } from '../adapters/url'
import { injectCopilotStyles } from '../ui/styles'
import { themeToCssVars } from '../ui/theme'
import { HistoryRail } from './history-rail'
import { Launcher } from './launcher'
import { CopilotPanel, type CopilotPanelProps } from './panel'

const WIDTH_STORAGE_KEY = 'netix-copilot.width'
const OPEN_STORAGE_KEY = 'netix-copilot.open'
const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 430
// How far the card floats from the viewport's inline-end edge (.nxcp-dock in styles.ts).
const DOCK_INSET = 22

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Persistence is optional.
  }
}

function clampWidth(width: number, fallback = DEFAULT_WIDTH): number {
  if (!Number.isFinite(width)) return fallback
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
}

// `expanded` is the package's own large view: a centred sheet with the history rail beside the
// panel, no host route needed. `full` is the pre-0.5 contract, where the host page draws the
// panel itself; the dock still steps aside for it, but Expand no longer leads there.
export type CopilotDockMode = 'min' | 'dock' | 'expanded' | 'full'

export interface CopilotDockProps extends Omit<CopilotPanelProps, 'className' | 'layout'> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  showLauncher?: boolean
  container?: HTMLElement | null
  // `open` is `mode !== 'min'`. In `full` mode the dock renders nothing but keeps its state: a
  // host page places CopilotPanel and HistoryRail itself and hands the mode back here.
  mode?: CopilotDockMode
  onModeChange?: (mode: CopilotDockMode) => void
  // The host's URL (see `CopilotUrlState`). With it the dock opens from `?ai_open=1`, restores
  // `?thread=<id>`, writes the flag when opened and clears both when closed, and stays open across
  // navigation once opened. `mode` and `open` still win when supplied.
  urlState?: CopilotUrlState
}

export function CopilotDock({
  open: openProp,
  onOpenChange,
  defaultOpen,
  showLauncher = true,
  container,
  mode: modeProp,
  onModeChange,
  urlState,
  headerActions,
  showThreads = true,
  ...panelProps
}: CopilotDockProps): ReactNode {
  const { t, theme } = useCopilotAdapters()
  const engine = useCopilotEngine()
  const { threadId } = useCopilotState()
  const enabled = useCopilotEnabled()
  // The URL is the source of the open state when a host passes it, so storage is not consulted.
  const controlled = openProp !== undefined || modeProp !== undefined || urlState !== undefined
  const [localMode, setLocalMode] = useState<CopilotDockMode>(() => {
    if (urlState !== undefined) return 'min'
    const stored = readStored(OPEN_STORAGE_KEY)
    const open = stored === null ? (defaultOpen ?? false) : stored === 'true'
    return open ? 'dock' : 'min'
  })
  const urlOpen = urlState !== undefined && isUrlOpen(urlState)
  const urlThread = urlState === undefined ? undefined : readUrlThread(urlState)
  let mode: CopilotDockMode
  if (modeProp !== undefined) mode = modeProp
  // `open` says open or closed; whether an open dock is expanded stays the dock's own state.
  else if (openProp !== undefined)
    mode = !openProp ? 'min' : localMode === 'expanded' ? 'expanded' : 'dock'
  else if (urlOpen && localMode === 'min') mode = 'dock'
  else mode = localMode
  const setMode = useCallback(
    (next: CopilotDockMode) => {
      if (modeProp === undefined) setLocalMode(next)
      const nextOpen = next !== 'min'
      if (urlState !== undefined && nextOpen !== urlOpen) {
        urlState.set(
          nextOpen
            ? { [COPILOT_URL_PARAMS.open]: '1' }
            : { [COPILOT_URL_PARAMS.open]: null, [COPILOT_URL_PARAMS.thread]: null },
        )
      }
      onModeChange?.(next)
      if (nextOpen !== (mode !== 'min')) onOpenChange?.(nextOpen)
    },
    [modeProp, mode, onModeChange, onOpenChange, urlOpen, urlState],
  )
  // A `?thread=` link restores that conversation once the dock is open; closing drops the link, so
  // a later link to the same thread restores it again. The thread already open is never
  // re-selected, which would abort a live run.
  const restoredThread = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (urlThread === undefined) {
      restoredThread.current = undefined
      return
    }
    if (mode === 'min' || restoredThread.current === urlThread) return
    restoredThread.current = urlThread
    if (threadId !== urlThread) engine.selectThread(urlThread)
  }, [engine, mode, threadId, urlThread])
  const [width, setWidth] = useState(() => {
    const stored = Number(readStored(WIDTH_STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH
  })
  const resizing = useRef(false)

  useEffect(() => injectCopilotStyles(), [])
  useEffect(() => {
    if (!controlled) writeStored(OPEN_STORAGE_KEY, localMode === 'min' ? 'false' : 'true')
  }, [controlled, localMode])
  useEffect(() => writeStored(WIDTH_STORAGE_KEY, String(width)), [width])
  useEffect(() => engine.recordDockMode(enabled ? mode : 'min'), [enabled, engine, mode])

  if (!enabled) return null
  const target =
    container === undefined ? (typeof document === 'undefined' ? null : document.body) : container
  if (!target || mode === 'full') return null

  const controls = (
    <>
      {headerActions}
      {mode === 'expanded' ? (
        <button
          type='button'
          className='nxcp-icon-button'
          aria-label={t('copilot.dock.collapse')}
          title={t('copilot.dock.collapse')}
          onClick={() => setMode('dock')}
        >
          <Icon path='M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7' />
        </button>
      ) : (
        <button
          type='button'
          className='nxcp-icon-button'
          aria-label={t('copilot.dock.expand')}
          title={t('copilot.dock.expand')}
          onClick={() => setMode('expanded')}
        >
          <Icon path='M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7' />
        </button>
      )}
      <button
        type='button'
        className='nxcp-icon-button'
        aria-label={t('copilot.dock.close')}
        title={t('copilot.dock.close')}
        onClick={() => setMode('min')}
      >
        <Icon path='M6 6l12 12M18 6L6 18' />
      </button>
    </>
  )

  let content: ReactNode = null
  if (mode === 'expanded') {
    content = (
      <div className='nxcp-root nxcp-expanded-layer' style={themeToCssVars(theme)}>
        <div className='nxcp-backdrop' aria-hidden='true' onClick={() => setMode('dock')} />
        <div
          className='nxcp-expanded'
          role='dialog'
          aria-modal='true'
          aria-label={t('copilot.dock.label')}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.defaultPrevented) setMode('dock')
          }}
        >
          <aside className='nxcp-expanded-rail' aria-label={t('copilot.threads.label')}>
            <HistoryRail />
          </aside>
          <CopilotPanel
            {...panelProps}
            layout='expanded'
            autoFocus
            // The rail sits beside the panel; the popover only shows where the rail cannot fit.
            showThreads={showThreads}
            headerActions={controls}
          />
        </div>
      </div>
    )
  } else if (mode === 'dock') {
    content = (
      <aside
        className='nxcp-root nxcp-dock'
        style={{ ...themeToCssVars(theme), width }}
        role='complementary'
        aria-label={t('copilot.dock.label')}
      >
        <button
          type='button'
          className='nxcp-resize'
          aria-label={t('copilot.dock.resize')}
          onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
            resizing.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!resizing.current) return
            // The handle sits on the inline-start edge, so which way "wider" points depends
            // on the writing direction.
            const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
            const edge = rtl ? event.clientX : window.innerWidth - event.clientX
            setWidth((current) => clampWidth(edge - DOCK_INSET, current))
          }}
          onPointerUp={(event) => {
            resizing.current = false
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setWidth((current) => clampWidth(current + 24))
            if (event.key === 'ArrowRight') setWidth((current) => clampWidth(current - 24))
          }}
        />
        <CopilotPanel
          {...panelProps}
          layout='dock'
          showThreads={showThreads}
          headerActions={controls}
        />
      </aside>
    )
  } else if (showLauncher) {
    content = <Launcher onOpen={() => setMode('dock')} />
  }

  return createPortal(content, target)
}

function Icon({ path }: { path: string }): ReactNode {
  return (
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
      <path d={path} />
    </svg>
  )
}
