import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

import {
  useCopilotAdapters,
  useCopilotConfig,
  useCopilotEngine,
  useCopilotState,
} from '../adapters/context'
import type { TranslateFn } from '../adapters/types'
import type { CopilotThread } from '../types'
import { useNotify } from './notify'

export interface HistoryRailProps {
  // Drops the New button (the dock header already has one) and tightens the rows.
  compact?: boolean
  // Injectable for tests; defaults to a clock that ticks once a minute.
  now?: number
  // Loading the list is a plain GET, so it is safe on mount; it opens no stream.
  autoLoad?: boolean
}

const MS_DAY = 86_400_000
const MS_MINUTE = 60_000
const TITLE_MAX = 48

type Group = 'pinned' | 'today' | 'yesterday' | 'week' | 'earlier'
const GROUP_ORDER: readonly Group[] = ['pinned', 'today', 'yesterday', 'week', 'earlier']

function localDay(ms: number): number {
  return new Date(ms).setHours(0, 0, 0, 0)
}

// Calendar days between two instants in the viewer's zone; rounding absorbs DST hours.
function daysAgo(ms: number, now: number): number {
  return Math.round((localDay(now) - localDay(ms)) / MS_DAY)
}

function groupOf(thread: CopilotThread, now: number): Group {
  if (thread.isPinned) return 'pinned'
  const ago = daysAgo(thread.updatedAt, now)
  return ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : ago <= 6 ? 'week' : 'earlier'
}

function whenLabel(ms: number, now: number, t: TranslateFn): string {
  const ago = daysAgo(ms, now)
  const date = new Date(ms)
  if (ago <= 0) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  }
  if (ago === 1) return t('copilot.history.yesterday')
  if (ago <= 6) return date.toLocaleDateString(undefined, { weekday: 'short' })
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function clip(title: string): string {
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title
}

function subscribeMinute(listener: () => void): () => void {
  const handle = setInterval(listener, MS_MINUTE)
  return () => clearInterval(handle)
}

// Quantised to the minute, so every render inside one minute reads the same value and the
// grouping cannot tear between a render and its commit.
function minuteNow(): number {
  return Math.floor(Date.now() / MS_MINUTE) * MS_MINUTE
}

function useMinuteClock(): number {
  return useSyncExternalStore(subscribeMinute, minuteNow, minuteNow)
}

export function HistoryRail({
  compact = false,
  now: nowProp,
  autoLoad = true,
}: HistoryRailProps): ReactNode {
  const { t, logger: adapterLogger } = useCopilotAdapters()
  const config = useCopilotConfig()
  const logger = adapterLogger ?? config.logger
  const engine = useCopilotEngine()
  const state = useCopilotState()
  const notify = useNotify()
  const clock = useMinuteClock()
  const now = nowProp ?? clock
  const baseId = useId()
  const [search, setSearch] = useState('')
  const [menuId, setMenuId] = useState<string>()
  const [renameId, setRenameId] = useState<string>()
  const [renameValue, setRenameValue] = useState('')
  const [confirmId, setConfirmId] = useState<string>()
  const openRow = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (!autoLoad || state.threadsLoaded) return
    void engine.loadThreads()
  }, [autoLoad, engine, state.threadsLoaded])

  useEffect(() => {
    if (menuId === undefined) return
    const onPointerDown = (event: MouseEvent) => {
      if (openRow.current?.contains(event.target as Node)) return
      setMenuId(undefined)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuId])

  const term = search.trim().toLowerCase()
  const visible = state.threads
    .filter((thread) => term === '' || thread.title.toLowerCase().includes(term))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: visible.filter((thread) => groupOf(thread, now) === group),
  })).filter((entry) => entry.items.length > 0)

  const commitRename = (thread: CopilotThread) => {
    const title = renameValue.trim() || t('copilot.history.untitled')
    setRenameId(undefined)
    if (title === thread.title) return
    // The engine already logs a refused update and restores the row.
    void engine.updateThread(thread.id, { title }).catch(() => undefined)
  }

  const togglePin = (thread: CopilotThread) => {
    setMenuId(undefined)
    void engine.updateThread(thread.id, { isPinned: !thread.isPinned }).catch(() => undefined)
  }

  const remove = (thread: CopilotThread) => {
    setConfirmId(undefined)
    void engine
      .deleteThread(thread.id)
      .then(() => notify({ message: t('copilot.history.deleted') }))
      .catch((error: unknown) => logger?.warn('netix-copilot: thread delete failed', error))
  }

  const renderRow = (thread: CopilotThread) => {
    const active = thread.id === state.threadId
    const menuOpen = menuId === thread.id
    return (
      <li
        key={thread.id}
        className='nxcp-thread-row'
        ref={menuOpen ? openRow : undefined}
        onKeyDown={(event: ReactKeyboardEvent<HTMLLIElement>) => {
          if (event.key === 'Escape' && menuOpen) setMenuId(undefined)
        }}
      >
        {renameId === thread.id ? (
          <input
            className='nxcp-thread-rename'
            aria-label={t('copilot.history.rename')}
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') commitRename(thread)
              if (event.key === 'Escape') {
                // Escape here must not also close the popover the rail may sit in.
                event.stopPropagation()
                setRenameId(undefined)
              }
            }}
          />
        ) : confirmId === thread.id ? (
          <div
            className='nxcp-thread-confirm'
            role='group'
            aria-label={t('copilot.history.confirmDelete')}
          >
            <span>{t('copilot.history.confirmDelete')}</span>
            <button
              type='button'
              className='nxcp-icon-button'
              data-tone='danger'
              onClick={() => remove(thread)}
            >
              {t('copilot.history.delete')}
            </button>
            <button
              type='button'
              className='nxcp-icon-button'
              onClick={() => setConfirmId(undefined)}
            >
              {t('copilot.history.cancel')}
            </button>
          </div>
        ) : (
          <>
            <button
              type='button'
              className='nxcp-thread'
              aria-current={active ? 'true' : undefined}
              onClick={() => engine.selectThread(thread.id)}
            >
              <span className='nxcp-thread-title'>
                {clip(thread.title) || t('copilot.history.untitled')}
              </span>
              <span className='nxcp-thread-meta'>
                {thread.modelTier ? (
                  <span className='nxcp-badge'>{t(`copilot.tier.${thread.modelTier}`)}</span>
                ) : null}
                {thread.surface ? <span className='nxcp-badge'>{thread.surface}</span> : null}
                <span className='nxcp-thread-time'>{whenLabel(thread.updatedAt, now, t)}</span>
              </span>
            </button>
            <button
              type='button'
              className='nxcp-icon-button nxcp-thread-kebab'
              aria-label={t('copilot.history.menu')}
              aria-haspopup='menu'
              aria-expanded={menuOpen}
              onClick={() => setMenuId(menuOpen ? undefined : thread.id)}
            >
              <svg
                width={13}
                height={13}
                viewBox='0 0 24 24'
                fill='currentColor'
                aria-hidden='true'
              >
                <circle cx='5' cy='12' r='1.7' />
                <circle cx='12' cy='12' r='1.7' />
                <circle cx='19' cy='12' r='1.7' />
              </svg>
            </button>
            {menuOpen ? (
              <div role='menu' className='nxcp-thread-menu'>
                <button type='button' role='menuitem' onClick={() => togglePin(thread)}>
                  {t(thread.isPinned ? 'copilot.history.unpin' : 'copilot.history.pin')}
                </button>
                <button
                  type='button'
                  role='menuitem'
                  onClick={() => {
                    setMenuId(undefined)
                    setRenameValue(thread.title)
                    setRenameId(thread.id)
                  }}
                >
                  {t('copilot.history.rename')}
                </button>
                <button
                  type='button'
                  role='menuitem'
                  data-tone='danger'
                  onClick={() => {
                    setMenuId(undefined)
                    setConfirmId(thread.id)
                  }}
                >
                  {t('copilot.history.delete')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </li>
    )
  }

  return (
    <div className='nxcp-history' data-compact={compact ? 'true' : 'false'}>
      {compact ? null : (
        <button type='button' className='nxcp-history-new' onClick={() => engine.startNewThread()}>
          <svg
            width={13}
            height={13}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2.6}
            aria-hidden='true'
          >
            <path d='M12 5v14M5 12h14' />
          </svg>
          {t('copilot.dock.new')}
        </button>
      )}
      <label className='nxcp-history-search'>
        <svg
          width={13}
          height={13}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.4}
          aria-hidden='true'
        >
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </svg>
        <input
          type='search'
          value={search}
          aria-label={t('copilot.history.search')}
          placeholder={t('copilot.history.search')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {!state.threadsLoaded ? (
        <p className='nxcp-empty'>{t('copilot.threads.loading')}</p>
      ) : groups.length === 0 ? (
        <p className='nxcp-empty'>
          {term === ''
            ? t('copilot.threads.empty')
            : t('copilot.history.noMatch', { search: search.trim() })}
        </p>
      ) : (
        <nav className='nxcp-history-list' aria-label={t('copilot.threads.label')}>
          {groups.map(({ group, items }) => (
            <div key={group}>
              <div className='nxcp-history-group' id={`${baseId}-${group}`}>
                {t(`copilot.history.${group}`)}
              </div>
              <ul className='nxcp-history-items' aria-labelledby={`${baseId}-${group}`}>
                {items.map(renderRow)}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </div>
  )
}

// The dock's header control: an icon button that drops the compact rail below it. Closes on
// Escape, on a click outside, and once a conversation has been chosen.
export function ThreadsPopover(): ReactNode {
  const { t } = useCopilotAdapters()
  const { threadId } = useCopilotState()
  // Remembers which conversation was open when the popover opened, so choosing another one
  // closes it without an effect.
  const [openedOn, setOpenedOn] = useState<{ thread: string | undefined } | null>(null)
  const open = openedOn !== null && openedOn.thread === threadId
  const setOpen = (next: boolean) => setOpenedOn(next ? { thread: threadId } : null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const popover = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popover.current?.contains(target) || trigger.current?.contains(target)) return
      setOpenedOn(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenedOn(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={trigger}
        type='button'
        className='nxcp-icon-button'
        aria-label={t('copilot.threads.label')}
        title={t('copilot.threads.label')}
        aria-haspopup='dialog'
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg
          width={13}
          height={13}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.4}
          strokeLinecap='round'
          aria-hidden='true'
        >
          <path d='M4 6h16M4 12h16M4 18h10' />
        </svg>
      </button>
      {open ? (
        <div
          ref={popover}
          role='dialog'
          aria-label={t('copilot.threads.label')}
          className='nxcp-threads-popover'
        >
          <HistoryRail compact />
        </div>
      ) : null}
    </>
  )
}
