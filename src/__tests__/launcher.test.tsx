import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CopilotProvider } from '../adapters/context'
import type { CopilotAdapters } from '../adapters/types'
import { Launcher } from '../components/launcher'
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

function mount(onOpen = vi.fn(), overrides: Partial<CopilotAdapters> = {}) {
  render(
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters(overrides)}
      transport={transport}
    >
      <Launcher onOpen={onOpen} />
    </CopilotProvider>,
  )
  return screen.getByRole('button', { name: 'Copilot assistant' })
}

describe('Launcher', () => {
  it('keeps the root and launcher classes hosts style against', () => {
    const pill = mount()
    expect(pill.className).toBe('nxcp-root nxcp-launcher')
    expect(pill.getAttribute('data-expanded')).toBe('false')
    expect(screen.getByText('Ask Copilot')).toBeTruthy()
    expect(pill.querySelector('.nxcp-launcher-chevron')).toBeNull()
    expect(pill.querySelector('.nxcp-launcher-halo')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('reveals the label and chevron on hover and on focus', () => {
    const pill = mount()
    fireEvent.mouseEnter(pill)
    expect(pill.getAttribute('data-expanded')).toBe('true')
    expect(pill.querySelector('.nxcp-launcher-chevron')).toBeTruthy()
    fireEvent.mouseLeave(pill)
    expect(pill.getAttribute('data-expanded')).toBe('false')
    expect(pill.querySelector('.nxcp-launcher-chevron')).toBeNull()

    fireEvent.focus(pill)
    expect(pill.getAttribute('data-expanded')).toBe('true')
    fireEvent.blur(pill)
    expect(pill.getAttribute('data-expanded')).toBe('false')
  })

  it('opens on click and settles the pill first', () => {
    const onOpen = vi.fn()
    const pill = mount(onOpen)
    fireEvent.mouseEnter(pill)
    fireEvent.click(pill)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(pill.getAttribute('data-expanded')).toBe('false')
  })

  it('routes its strings through the host translate function', () => {
    const t = vi.fn((key: string) => `T:${key}`)
    render(
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters({ t })}
        transport={transport}
      >
        <Launcher onOpen={() => undefined} />
      </CopilotProvider>,
    )
    expect(screen.getByRole('button', { name: 'T:copilot.dock.label' })).toBeTruthy()
    expect(screen.getByText('T:copilot.dock.open')).toBeTruthy()
  })

  it('applies host theme tokens as CSS variables', () => {
    const pill = mount(vi.fn(), { theme: { accent: 'rgb(1, 2, 3)', accentText: '#fff' } })
    expect(pill.style.getPropertyValue('--nxcp-accent')).toBe('rgb(1, 2, 3)')
    expect(pill.style.getPropertyValue('--nxcp-accent-text')).toBe('#fff')
  })
})
