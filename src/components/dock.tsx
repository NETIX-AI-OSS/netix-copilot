import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useCopilotAdapters, useCopilotEnabled } from '../adapters/context'
import { injectCopilotStyles } from '../ui/styles'
import { themeToCssVars } from '../ui/theme'
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

export type CopilotDockMode = 'min' | 'dock' | 'full'

export interface CopilotDockProps extends Omit<CopilotPanelProps, 'className' | 'layout'> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  showLauncher?: boolean
  container?: HTMLElement | null
  // `open` is `mode !== 'min'`. In full mode the dock renders nothing but keeps its state: the
  // host page places CopilotPanel and HistoryRail itself and hands the mode back here.
  mode?: CopilotDockMode
  // Expand is only offered when the host can act on it, since full mode is the host's page.
  onModeChange?: (mode: CopilotDockMode) => void
}

export function CopilotDock({
  open: openProp,
  onOpenChange,
  defaultOpen,
  showLauncher = true,
  container,
  mode: modeProp,
  onModeChange,
  headerActions,
  showThreads = true,
  ...panelProps
}: CopilotDockProps): ReactNode {
  const { t, theme } = useCopilotAdapters()
  const enabled = useCopilotEnabled()
  const controlled = openProp !== undefined || modeProp !== undefined
  const [localMode, setLocalMode] = useState<CopilotDockMode>(() => {
    const stored = readStored(OPEN_STORAGE_KEY)
    const open = stored === null ? (defaultOpen ?? false) : stored === 'true'
    return open ? 'dock' : 'min'
  })
  const mode: CopilotDockMode =
    modeProp ?? (openProp === undefined ? localMode : openProp ? 'dock' : 'min')
  const setMode = useCallback(
    (next: CopilotDockMode) => {
      if (modeProp === undefined) setLocalMode(next)
      onModeChange?.(next)
      if ((next !== 'min') !== (mode !== 'min')) onOpenChange?.(next !== 'min')
    },
    [modeProp, mode, onModeChange, onOpenChange],
  )
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

  if (!enabled) return null
  const target =
    container === undefined ? (typeof document === 'undefined' ? null : document.body) : container
  if (!target || mode === 'full') return null

  const content =
    mode === 'dock' ? (
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
          headerActions={
            <>
              {headerActions}
              <button
                type='button'
                className='nxcp-icon-button'
                aria-label={t('copilot.dock.minimise')}
                title={t('copilot.dock.minimise')}
                onClick={() => setMode('min')}
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
                  <path d='M5 12h14' />
                </svg>
              </button>
              {onModeChange ? (
                <button
                  type='button'
                  className='nxcp-icon-button'
                  aria-label={t('copilot.dock.expand')}
                  title={t('copilot.dock.expand')}
                  onClick={() => setMode('full')}
                >
                  <svg
                    width={13}
                    height={13}
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2.2}
                    aria-hidden='true'
                  >
                    <path d='M8 3H3v5M3 3l7 7M16 21h5v-5M21 21l-7-7' />
                  </svg>
                </button>
              ) : null}
              <button
                type='button'
                className='nxcp-icon-button'
                aria-label={t('copilot.dock.close')}
                title={t('copilot.dock.close')}
                onClick={() => setMode('min')}
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
                  <path d='M6 6l12 12M18 6L6 18' />
                </svg>
              </button>
            </>
          }
        />
      </aside>
    ) : showLauncher ? (
      <Launcher onOpen={() => setMode('dock')} />
    ) : null

  return createPortal(content, target)
}
