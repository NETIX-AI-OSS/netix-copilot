import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CopilotProvider, useCopilotEngine } from '../adapters/context'
import type { CopilotAdapters } from '../adapters/types'
import type { HistoryRailProps } from '../components/history-rail'
import { HistoryRail } from '../components/history-rail'
import { ThreadList } from '../components/thread-list'
import type { CopilotEngine } from '../runtime/engine'
import type { CopilotTransport, CreatedTurn, ThreadPatch } from '../transport/types'
import type { CopilotThread } from '../types'
import { createFallbackTranslate } from '../ui/i18n'
import { COPILOT_CSS } from '../ui/styles'
import { testAdapters } from './helpers'

const HOUR = 3_600_000
const DAY = 24 * HOUR
// A fixed local instant, so the calendar-day buckets are the same on every machine.
const NOW = new Date(2026, 8, 3, 14, 41).getTime()

function thread(overrides: Partial<CopilotThread> & { id: string }): CopilotThread {
  return { title: overrides.id, updatedAt: NOW, ...overrides }
}

class ThreadTransport implements CopilotTransport {
  readonly name = 'sse' as const
  threads: CopilotThread[] = [
    thread({ id: 'today', title: 'Today thread', updatedAt: NOW - 2 * HOUR, modelTier: 'high' }),
    thread({ id: 'yesterday', title: 'Yesterday thread', updatedAt: NOW - 26 * HOUR }),
    thread({ id: 'week', title: 'Week thread', updatedAt: NOW - 3 * DAY, surface: 'web' }),
    thread({ id: 'earlier', title: 'Earlier thread', updatedAt: NOW - 20 * DAY, surface: 'kiosk' }),
    thread({ id: 'pinned', title: 'Pinned thread', updatedAt: NOW - 40 * DAY, isPinned: true }),
    thread({
      id: 'long',
      title: 'A very long conversation title that keeps going well past the clip point',
      updatedAt: NOW - 30 * DAY,
    }),
  ]
  patches: Array<[string, ThreadPatch]> = []
  deleted: string[] = []
  refuseUpdate = false
  listCalls = 0

  async createTurn(): Promise<CreatedTurn> {
    return { turnId: 't1' }
  }

  async consumeRun(): Promise<void> {
    return Promise.resolve()
  }

  async cancelTurn(): Promise<void> {
    return Promise.resolve()
  }

  async respondToApproval(): Promise<void> {
    return Promise.resolve()
  }

  async listThreads(): Promise<CopilotThread[]> {
    this.listCalls += 1
    return this.threads
  }

  async updateThread(id: string, patch: ThreadPatch): Promise<CopilotThread> {
    if (this.refuseUpdate) throw new Error('refused')
    this.patches.push([id, patch])
    const saved = { ...this.threads.find((entry) => entry.id === id)!, ...patch }
    this.threads = this.threads.map((entry) => (entry.id === id ? saved : entry))
    return saved
  }

  async deleteThread(id: string): Promise<void> {
    this.deleted.push(id)
    this.threads = this.threads.filter((entry) => entry.id !== id)
  }
}

let engineRef: CopilotEngine | undefined

function Probe() {
  const engine = useCopilotEngine()
  // Captured in an effect, never during render, so the probe stays a pure component.
  useEffect(() => {
    engineRef = engine
  }, [engine])
  return null
}

function mount(
  transport: ThreadTransport,
  props: Partial<HistoryRailProps> = {},
  overrides: Partial<CopilotAdapters> = {},
) {
  return render(
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters(overrides)}
      transport={transport}
    >
      <Probe />
      <HistoryRail now={NOW} {...props} />
    </CopilotProvider>,
  )
}

function headings(): string[] {
  return [...document.querySelectorAll('.nxcp-history-group')].map((node) => node.textContent ?? '')
}

function titles(): string[] {
  return [...document.querySelectorAll('.nxcp-thread-title')].map((node) => node.textContent ?? '')
}

function stamp(title: string): string | undefined {
  return (screen.getByText(title).closest('.nxcp-thread') as HTMLElement).querySelector(
    '.nxcp-thread-time',
  )?.textContent
}

function openMenu(title: string): HTMLElement {
  const row = screen.getByText(title).closest('.nxcp-thread-row') as HTMLElement
  fireEvent.click(row.querySelector('.nxcp-thread-kebab') as HTMLElement)
  return row
}

describe('HistoryRail', () => {
  beforeEach(() => {
    engineRef = undefined
  })

  it('groups by the local calendar day with pinned first', async () => {
    mount(new ThreadTransport())
    expect(await screen.findByText('Today thread')).toBeTruthy()
    expect(headings()).toEqual(['Pinned', 'Today', 'Yesterday', 'This week', 'Earlier'])
    expect(titles()).toEqual([
      'Pinned thread',
      'Today thread',
      'Yesterday thread',
      'Week thread',
      'Earlier thread',
      'A very long conversation title that keeps going…',
    ])
  })

  it('stamps each row the way the reference does', async () => {
    mount(new ThreadTransport())
    await screen.findByText('Today thread')
    expect(stamp('Today thread')).toMatch(/^\d{2}:\d{2}$/)
    expect(stamp('Yesterday thread')).toBe('Yesterday')
    expect(stamp('Week thread')).toBe(
      new Date(NOW - 3 * DAY).toLocaleDateString(undefined, { weekday: 'short' }),
    )
    expect(stamp('Earlier thread')).toBe(
      new Date(NOW - 20 * DAY).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    )
  })

  it('formats the stamps in the locale adapter when one is given', async () => {
    mount(new ThreadTransport(), {}, { locale: 'en-GB' })
    await screen.findByText('Today thread')
    const earlier = new Date(NOW - 20 * DAY)
    const dayMonth = { day: 'numeric', month: 'short' } as const
    expect(stamp('Earlier thread')).toBe(earlier.toLocaleDateString('en-GB', dayMonth))
    expect(stamp('Earlier thread')).not.toBe(earlier.toLocaleDateString('en-US', dayMonth))
    expect(stamp('Week thread')).toBe(
      new Date(NOW - 3 * DAY).toLocaleDateString('en-GB', { weekday: 'short' }),
    )
    expect(stamp('Today thread')).toBe(
      new Date(NOW - 2 * HOUR).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    )
  })

  it('shows the tier and surface as small chips', async () => {
    mount(new ThreadTransport())
    await screen.findByText('Today thread')
    expect(screen.getByText('High 5x').className).toBe('nxcp-badge')
    expect(screen.getByText('Web').className).toBe('nxcp-badge')
    expect(screen.queryByText('Base 1x')).toBeNull()
    // The raw wire value never prints, and a surface the SDK does not know draws no badge.
    expect(screen.queryByText('web')).toBeNull()
    expect(screen.queryByText('kiosk')).toBeNull()
    expect(
      screen.getByText('Earlier thread').closest('.nxcp-thread')?.querySelector('.nxcp-badge'),
    ).toBeNull()
  })

  it('names the surface through the translate adapter', async () => {
    const t = createFallbackTranslate({ 'copilot.surface.web': 'Browser' })
    mount(new ThreadTransport(), {}, { t })
    await screen.findByText('Today thread')
    expect(screen.getByText('Browser').className).toBe('nxcp-badge')
  })

  it('searches titles client-side and says when nothing matches', async () => {
    mount(new ThreadTransport())
    await screen.findByText('Today thread')
    const search = screen.getByRole('searchbox', { name: 'Search conversations' })
    fireEvent.change(search, { target: { value: 'WEEK' } })
    expect(titles()).toEqual(['Week thread'])
    expect(headings()).toEqual(['This week'])
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByText('No conversations match "zzz".')).toBeTruthy()
  })

  it('selects a conversation and marks the open one', async () => {
    mount(new ThreadTransport())
    await screen.findByText('Today thread')
    const row = screen.getByText('Today thread').closest('.nxcp-thread') as HTMLElement
    expect(row.getAttribute('aria-current')).toBeNull()
    await act(async () => {
      fireEvent.click(row)
    })
    expect(engineRef?.getSnapshot().threadId).toBe('today')
    expect(
      (screen.getByText('Today thread').closest('.nxcp-thread') as HTMLElement).getAttribute(
        'aria-current',
      ),
    ).toBe('true')
  })

  it('pins and unpins through the transport', async () => {
    const transport = new ThreadTransport()
    mount(transport)
    await screen.findByText('Today thread')
    openMenu('Week thread')
    expect(screen.getByRole('group', { name: 'Conversation actions' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pin' }))
    })
    expect(transport.patches).toEqual([['week', { isPinned: true }]])
    expect(screen.queryByRole('group', { name: 'Conversation actions' })).toBeNull()
    // Pinned rows keep the newest-first order among themselves.
    await waitFor(() => expect(titles().slice(0, 2)).toEqual(['Week thread', 'Pinned thread']))

    openMenu('Week thread')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unpin' }))
    })
    expect(transport.patches[1]).toEqual(['week', { isPinned: false }])
  })

  it('renames inline: Enter commits, Escape cancels, blank falls back to Untitled', async () => {
    const transport = new ThreadTransport()
    mount(transport)
    await screen.findByText('Today thread')

    openMenu('Today thread')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByRole('textbox', { name: 'Rename' }) as HTMLInputElement
    expect(input.value).toBe('Today thread')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(transport.patches).toEqual([['today', { title: 'Renamed' }]])
    expect(await screen.findByText('Renamed')).toBeTruthy()

    openMenu('Renamed')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename' }), { target: { value: '  ' } })
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename' }), { key: 'Enter' })
    })
    expect(transport.patches[1]).toEqual(['today', { title: 'Untitled' }])

    openMenu('Untitled')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename' }), {
      target: { value: 'abandoned' },
    })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename' }), { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull()
    expect(transport.patches).toHaveLength(2)
    expect(screen.getByText('Untitled')).toBeTruthy()
  })

  it('deletes after an inline confirmation and says so', async () => {
    const transport = new ThreadTransport()
    const notify = vi.fn()
    mount(transport, {}, { notify })
    await screen.findByText('Today thread')

    openMenu('Earlier thread')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('group', { name: 'Delete this conversation?' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Delete this conversation?' })).toBeNull()
    expect(transport.deleted).toEqual([])
    expect(confirm.isConnected).toBe(false)

    openMenu('Earlier thread')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    expect(transport.deleted).toEqual(['earlier'])
    expect(screen.queryByText('Earlier thread')).toBeNull()
    expect(notify).toHaveBeenCalledWith({ message: 'Conversation deleted' })
  })

  it('surfaces a refused update through the logger only', async () => {
    const transport = new ThreadTransport()
    transport.refuseUpdate = true
    const logger = { warn: vi.fn(), error: vi.fn() }
    // The engine owns the update and reports through the config logger, as it does for a
    // failed cancel or an unavailable transcript.
    render(
      <CopilotProvider
        config={{ baseUrl: 'https://x', logger }}
        adapters={testAdapters()}
        transport={transport}
      >
        <HistoryRail now={NOW} />
      </CopilotProvider>,
    )
    await screen.findByText('Today thread')
    openMenu('Week thread')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pin' }))
    })
    await waitFor(() => expect(logger.warn).toHaveBeenCalled())
    expect(headings()[0]).toBe('Pinned')
    expect(titles()[0]).toBe('Pinned thread')
  })

  it('closes the menu on Escape and on a click outside', async () => {
    mount(new ThreadTransport())
    await screen.findByText('Today thread')
    const row = openMenu('Today thread')
    fireEvent.keyDown(row, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Conversation actions' })).toBeNull()

    openMenu('Today thread')
    fireEvent.mouseDown(screen.getByRole('group', { name: 'Conversation actions' }))
    expect(screen.getByRole('group', { name: 'Conversation actions' })).toBeTruthy()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('group', { name: 'Conversation actions' })).toBeNull()
  })

  // The row actions are Tab-reachable buttons, so they must not promise the arrow-key model a
  // menu role would announce.
  it('offers the row actions as plain buttons, not a menu', async () => {
    mount(new ThreadTransport())
    await screen.findByText('Today thread')
    const row = openMenu('Today thread')
    expect(row.querySelector('.nxcp-thread-kebab')?.getAttribute('aria-haspopup')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByRole('menuitem')).toBeNull()
    const group = screen.getByRole('group', { name: 'Conversation actions' })
    expect([...group.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'Pin',
      'Rename',
      'Delete',
    ])
  })

  it('styles the grouped rows as a flush list', () => {
    expect(COPILOT_CSS).toContain('.nxcp-history-items {')
    expect(COPILOT_CSS).toContain('.nxcp-thread-menu button {')
  })

  it('offers New chat in the full rail and drops it when compact', async () => {
    const transport = new ThreadTransport()
    const { unmount } = mount(transport)
    await screen.findByText('Today thread')
    await act(async () => {
      fireEvent.click(screen.getByText('Today thread'))
    })
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(engineRef?.getSnapshot().threadId).toBeUndefined()
    unmount()

    mount(transport, { compact: true })
    await screen.findByText('Today thread')
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull()
    expect(document.querySelector('.nxcp-history')?.getAttribute('data-compact')).toBe('true')
  })

  it('loads the list on mount only once, and not at all when told not to', async () => {
    const transport = new ThreadTransport()
    const { unmount } = mount(transport, { autoLoad: false })
    expect(screen.getByText('Loading conversations…')).toBeTruthy()
    expect(transport.listCalls).toBe(0)
    unmount()

    mount(transport)
    await screen.findByText('Today thread')
    expect(transport.listCalls).toBe(1)
  })

  it('falls back to a live clock when no instant is injected', async () => {
    const transport = new ThreadTransport()
    transport.threads = [thread({ id: 'fresh', title: 'Fresh thread', updatedAt: Date.now() })]
    mount(transport, { now: undefined })
    await screen.findByText('Fresh thread')
    expect(headings()).toEqual(['Today'])
  })
})

describe('ThreadList', () => {
  it('stays a thin wrapper over the compact rail', async () => {
    const transport = new ThreadTransport()
    render(
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters()}
        transport={transport}
      >
        <ThreadList />
      </CopilotProvider>,
    )
    expect(await screen.findByText('Today thread')).toBeTruthy()
    expect(document.querySelector('.nxcp-history')?.getAttribute('data-compact')).toBe('true')
  })
})
