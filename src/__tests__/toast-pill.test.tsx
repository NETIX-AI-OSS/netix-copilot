import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CopilotProvider } from '../adapters/context'
import type { CopilotAdapters } from '../adapters/types'
import { notificationStore, useNotify } from '../components/notify'
import { ToastHost } from '../components/toast-pill'
import type { CopilotTransport } from '../transport/types'
import { testAdapters } from './helpers'

const transport: CopilotTransport = {
  name: 'sse',
  createTurn: async () => ({ turnId: '1' }),
  consumeRun: async () => undefined,
  cancelTurn: async () => undefined,
  respondToApproval: async () => undefined,
  listThreads: async () => [],
}

function wrapper(overrides: Partial<CopilotAdapters> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters(overrides)}
        transport={transport}
      >
        {children}
      </CopilotProvider>
    )
  }
}

function mount(overrides: Partial<CopilotAdapters> = {}, hosts = 1) {
  const Wrapper = wrapper(overrides)
  return render(
    <Wrapper>
      {Array.from({ length: hosts }, (_, index) => (
        <ToastHost key={index} />
      ))}
    </Wrapper>,
  )
}

function pill(): HTMLElement | null {
  return document.querySelector('.nxcp-toast')
}

describe('ToastHost', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => notificationStore.dismiss())
    vi.useRealTimers()
  })

  it('keeps an empty polite live region mounted so the first toast is announced', () => {
    mount()
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(pill()).toBeNull()
  })

  it('shows a plain notification for three seconds', () => {
    mount()
    act(() => notificationStore.show({ message: 'Answer copied' }))
    expect(pill()?.textContent).toContain('Answer copied')
    expect(pill()?.getAttribute('data-tone')).toBe('info')
    act(() => vi.advanceTimersByTime(2999))
    expect(pill()).toBeTruthy()
    act(() => vi.advanceTimersByTime(1))
    expect(pill()).toBeNull()
  })

  it('keeps a notification with an action for 5.2 seconds and runs the action', () => {
    mount()
    const onSelect = vi.fn()
    act(() => notificationStore.show({ message: 'Deleted', action: { label: 'Undo', onSelect } }))
    act(() => vi.advanceTimersByTime(5199))
    expect(pill()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(pill()).toBeNull()
  })

  it('expires an action toast on its own after 5.2 seconds', () => {
    mount()
    act(() =>
      notificationStore.show({ message: 'Deleted', action: { label: 'Undo', onSelect: vi.fn() } }),
    )
    act(() => vi.advanceTimersByTime(5200))
    expect(pill()).toBeNull()
  })

  it('dismisses from its own button', () => {
    mount()
    act(() => notificationStore.show({ message: 'Answer copied' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(pill()).toBeNull()
  })

  it('replaces an earlier toast and restarts the timer', () => {
    mount()
    act(() => notificationStore.show({ message: 'first' }))
    act(() => vi.advanceTimersByTime(2500))
    act(() => notificationStore.show({ message: 'second' }))
    act(() => vi.advanceTimersByTime(2500))
    expect(pill()?.textContent).toContain('second')
    act(() => vi.advanceTimersByTime(500))
    expect(pill()).toBeNull()
  })

  it('marks an error tone on the pill', () => {
    mount()
    act(() => notificationStore.show({ message: 'Copy unavailable', tone: 'error' }))
    expect(pill()?.getAttribute('data-tone')).toBe('error')
  })

  it('paints once even when several panels each mount a host', () => {
    mount({}, 2)
    act(() => notificationStore.show({ message: 'Answer copied' }))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(document.querySelectorAll('.nxcp-toast')).toHaveLength(1)
  })

  it('hands over to the next host when the first unmounts', () => {
    const Wrapper = wrapper()
    const { rerender } = render(
      <Wrapper>
        <ToastHost key='a' />
        <ToastHost key='b' />
      </Wrapper>,
    )
    rerender(
      <Wrapper>
        <ToastHost key='b' />
      </Wrapper>,
    )
    act(() => notificationStore.show({ message: 'still shown' }))
    expect(pill()?.textContent).toContain('still shown')
  })
})

describe('useNotify', () => {
  afterEach(() => {
    act(() => notificationStore.dismiss())
  })

  it('falls back to the pill when the host has no toaster', () => {
    const { result } = renderHook(() => useNotify(), { wrapper: wrapper() })
    act(() => result.current({ message: 'via the pill' }))
    expect(notificationStore.getSnapshot().current?.message).toBe('via the pill')
  })

  it('defers to the host notifier when one is supplied', () => {
    const notify = vi.fn()
    const { result } = renderHook(() => useNotify(), { wrapper: wrapper({ notify }) })
    act(() => result.current({ message: 'via the host' }))
    expect(notify).toHaveBeenCalledWith({ message: 'via the host' })
    expect(notificationStore.getSnapshot().current).toBeUndefined()
  })
})
