import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useCopilotAdapters, useCopilotEnabled, useCopilotEngine } from '../adapters/context'
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
  const engine = useCopilotEngine()
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
