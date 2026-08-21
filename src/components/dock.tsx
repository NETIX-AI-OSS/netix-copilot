// The persistent dock.
//
// Mount it once at the application root, outside the router outlet, and it survives navigation
// because nothing about it is tied to a route. It portals into document.body so a transformed or
// positioned ancestor in the host layout cannot trap it in a stacking context, which is the
// failure mode a z-index alone does not fix.

import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  useCopilotAdapters,
  useCopilotEnabled,
  useCopilotEngine,
  useCopilotState,
} from '../adapters/context'
import { isRunActive } from '../runtime/run-store'
import { injectCopilotStyles } from '../ui/styles'
import { themeToCssVars } from '../ui/theme'
import { Composer } from './composer'
import { MessageView } from './message-view'
import { ThreadList } from './thread-list'
import { UsageFooter } from './usage-footer'

const WIDTH_STORAGE_KEY = 'netix-copilot.width'
const OPEN_STORAGE_KEY = 'netix-copilot.open'
const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 420
const KEYBOARD_STEP = 24

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Private windows and blocked site data throw on access rather than returning null.
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Persisting the dock size is a convenience, never a correctness requirement.
  }
}

function clampWidth(width: number, fallback = DEFAULT_WIDTH): number {
  // A pointer event without a usable coordinate must not turn the width into NaN.
  if (!Number.isFinite(width)) return fallback
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
}

export interface CopilotDockProps {
  // Rendered into the dock header, for a host-specific action such as "open in AI Studio".
  headerActions?: ReactNode
  defaultOpen?: boolean
  showThreads?: boolean
  // Escape hatch for tests and for hosts that render the dock inside their own portal.
  container?: HTMLElement | null
}

export function CopilotDock({
  headerActions,
  defaultOpen,
  showThreads = true,
  container,
}: CopilotDockProps): ReactNode {
  const { t, theme } = useCopilotAdapters()
  const engine = useCopilotEngine()
  const state = useCopilotState()
  const enabled = useCopilotEnabled()

  const [open, setOpen] = useState(() => {
    const stored = readStored(OPEN_STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return defaultOpen ?? false
  })
  const [width, setWidth] = useState(() => {
    const stored = Number(readStored(WIDTH_STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH
  })

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const resizingRef = useRef(false)

  useEffect(() => {
    injectCopilotStyles()
  }, [])

  useEffect(() => {
    writeStored(OPEN_STORAGE_KEY, open ? 'true' : 'false')
  }, [open])

  useEffect(() => {
    writeStored(WIDTH_STORAGE_KEY, String(width))
  }, [width])

  const run = state.turns[state.turns.length - 1]?.run
  const streaming = run !== undefined && isRunActive(run)
  const answerLength = run?.text.length ?? 0

  // Follow the stream, but only while the reader is already near the bottom.
  useEffect(() => {
    const node = bodyRef.current
    if (!node || !open) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    if (distance < 120) node.scrollTop = node.scrollHeight
  }, [answerLength, state.turns.length, open])

  const onResizePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    resizingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onResizePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizingRef.current) return
    setWidth((current) => clampWidth(window.innerWidth - event.clientX, current))
  }, [])

  const onResizePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    resizingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  if (!enabled) return null

  const style = themeToCssVars(theme)
  const target =
    container === undefined ? (typeof document === 'undefined' ? null : document.body) : container

  const content = open ? (
    <aside
      className='nxcp-root nxcp-dock'
      style={{ ...style, width }}
      role='complementary'
      aria-label={t('copilot.dock.label')}
      data-streaming={streaming ? 'true' : 'false'}
    >
      <button
        type='button'
        className='nxcp-resize'
        aria-label={t('copilot.dock.resize')}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setWidth((current) => clampWidth(current + KEYBOARD_STEP))
          if (event.key === 'ArrowRight') setWidth((current) => clampWidth(current - KEYBOARD_STEP))
        }}
      />
      <header className='nxcp-header'>
        <span className='nxcp-title'>{t('copilot.dock.title')}</span>
        {headerActions}
        <button
          type='button'
          className='nxcp-icon-button'
          onClick={() => engine.startNewThread()}
          disabled={streaming}
        >
          {t('copilot.dock.new')}
        </button>
        <button
          type='button'
          className='nxcp-icon-button'
          onClick={() => setOpen(false)}
          aria-label={t('copilot.dock.close')}
        >
          {'×'}
        </button>
      </header>

      {!state.online ? <div className='nxcp-banner'>{t('copilot.status.offline')}</div> : null}

      {showThreads ? <ThreadList /> : null}

      <div className='nxcp-body' ref={bodyRef}>
        {state.turns.length === 0 ? (
          <p className='nxcp-empty'>{t('copilot.dock.empty')}</p>
        ) : (
          state.turns.map((turn) => <MessageView key={turn.id} turn={turn} />)
        )}
      </div>

      <Composer autoFocus />

      <UsageFooter
        {...(run?.usage ? { usage: run.usage } : {})}
        {...(state.transport ? { transport: state.transport } : {})}
        {...(run?.model ? { model: run.model } : {})}
      />
    </aside>
  ) : (
    <button
      type='button'
      className='nxcp-root nxcp-launcher'
      style={style}
      onClick={() => setOpen(true)}
    >
      {t('copilot.dock.open')}
    </button>
  )

  if (!target) return null
  return createPortal(content, target)
}
