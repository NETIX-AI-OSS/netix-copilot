import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useCopilotAdapters, useCopilotEnabled } from '../adapters/context'
import { injectCopilotStyles } from '../ui/styles'
import { themeToCssVars } from '../ui/theme'
import { CopilotPanel, type CopilotPanelProps } from './panel'

const WIDTH_STORAGE_KEY = 'netix-copilot.width'
const OPEN_STORAGE_KEY = 'netix-copilot.open'
const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 420

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

export interface CopilotDockProps extends Omit<CopilotPanelProps, 'className'> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  showLauncher?: boolean
  container?: HTMLElement | null
}

export function CopilotDock({
  open: openProp,
  onOpenChange,
  defaultOpen,
  showLauncher = true,
  container,
  headerActions,
  showThreads = true,
  ...panelProps
}: CopilotDockProps): ReactNode {
  const { t, theme } = useCopilotAdapters()
  const enabled = useCopilotEnabled()
  const controlled = openProp !== undefined
  const [localOpen, setLocalOpen] = useState(() => {
    const stored = readStored(OPEN_STORAGE_KEY)
    return stored === null ? (defaultOpen ?? false) : stored === 'true'
  })
  const open = controlled ? openProp : localOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setLocalOpen(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange],
  )
  const [width, setWidth] = useState(() => {
    const stored = Number(readStored(WIDTH_STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH
  })
  const resizing = useRef(false)

  useEffect(() => injectCopilotStyles(), [])
  useEffect(() => {
    if (!controlled) writeStored(OPEN_STORAGE_KEY, localOpen ? 'true' : 'false')
  }, [controlled, localOpen])
  useEffect(() => writeStored(WIDTH_STORAGE_KEY, String(width)), [width])

  if (!enabled) return null
  const target =
    container === undefined ? (typeof document === 'undefined' ? null : document.body) : container
  if (!target) return null

  const content = open ? (
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
          if (resizing.current)
            setWidth((current) => clampWidth(window.innerWidth - event.clientX, current))
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
        showThreads={showThreads}
        headerActions={
          <>
            {headerActions}
            <button
              type='button'
              className='nxcp-icon-button'
              onClick={() => setOpen(false)}
              aria-label={t('copilot.dock.close')}
            >
              ×
            </button>
          </>
        }
      />
    </aside>
  ) : showLauncher ? (
    <button
      type='button'
      className='nxcp-root nxcp-launcher'
      style={themeToCssVars(theme)}
      onClick={() => setOpen(true)}
    >
      {t('copilot.dock.open')}
    </button>
  ) : null

  return createPortal(content, target)
}
