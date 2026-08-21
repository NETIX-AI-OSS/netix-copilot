import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CopilotProvider, useCopilotEngine } from '../adapters/context'
import { buildScope } from '../adapters/types'
import { Composer } from '../components/composer'
import { CopilotHttpError, joinUrl, requestJson } from '../transport/http'
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn } from '../transport/types'
import type { SendTurnInput } from '../types'
import { createFallbackTranslate, interpolate } from '../ui/i18n'
import { themeToCssVars } from '../ui/theme'
import { COPILOT_Z_INDEX, COPILOT_Z_INDEX_NOTES } from '../ui/z-index'
import { errorResponse, jsonResponse, testAdapters } from './helpers'

describe('buildScope', () => {
  it('normalizes the page context into one scope object', () => {
    const scope = buildScope(testAdapters().pageContext)
    expect(scope).toEqual({
      app: 'test-ui',
      route: '/assets/17',
      organization_id: 7,
      user_id: 42,
      route_params: { assetId: '17' },
      search_params: { tab: 'health' },
      entity: { type: 'asset', id: '17', label: 'AHU-1' },
    })
  })

  it('omits empty parameter maps rather than sending noise', () => {
    const scope = buildScope({
      app: 'a',
      route: '/',
      routeParams: {},
      searchParams: {},
      user: { id: 1, organizationId: 2 },
    })
    expect(scope).toEqual({ app: 'a', route: '/', organization_id: 2, user_id: 1 })
  })

  it('passes host store state straight through', () => {
    const scope = buildScope({
      app: 'a',
      route: '/',
      user: { id: 1, organizationId: 2 },
      state: { selectedTags: ['t1'] },
    })
    expect(scope.state).toEqual({ selectedTags: ['t1'] })
  })
})

describe('http helpers', () => {
  it('joins a base url and a path without doubling the slash', () => {
    expect(joinUrl('https://x.example.com/', '/api/y/')).toBe('https://x.example.com/api/y/')
    expect(joinUrl('https://x.example.com', 'api/y/')).toBe('https://x.example.com/api/y/')
  })

  it('leaves an absolute url alone', () => {
    expect(joinUrl('https://x.example.com', 'https://other/z')).toBe('https://other/z')
  })

  it('raises CopilotHttpError carrying the status and body', async () => {
    const fetchImpl = vi.fn(async () => errorResponse(403, 'forbidden'))
    await expect(
      requestJson({ baseUrl: 'https://x', fetchImpl: fetchImpl as never }, '/a/'),
    ).rejects.toMatchObject({ status: 403, body: 'forbidden' })
  })

  it('classifies only absent routes as fallback-worthy', () => {
    expect(new CopilotHttpError(404, '').isRouteMissing).toBe(true)
    expect(new CopilotHttpError(405, '').isRouteMissing).toBe(true)
    expect(new CopilotHttpError(501, '').isRouteMissing).toBe(true)
    expect(new CopilotHttpError(500, '').isRouteMissing).toBe(false)
    expect(new CopilotHttpError(403, '').isRouteMissing).toBe(false)
  })

  it('treats an empty body as an empty object', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => '',
    }))
    await expect(
      requestJson({ baseUrl: 'https://x', fetchImpl: fetchImpl as never }, '/a/'),
    ).resolves.toEqual({})
  })

  it('omits Authorization when the host has no token', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}))
    await requestJson({ baseUrl: 'https://x', fetchImpl: fetchImpl as never }, '/a/')
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('awaits an async token provider', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}))
    await requestJson(
      {
        baseUrl: 'https://x',
        fetchImpl: fetchImpl as never,
        getAuthToken: async () => 'later',
      },
      '/a/',
    )
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer later')
  })
})

describe('i18n helpers', () => {
  it('interpolates named variables', () => {
    expect(interpolate('{a} then {b}', { a: 1, b: 'two' })).toBe('1 then two')
  })

  it('leaves an unknown placeholder untouched', () => {
    expect(interpolate('{missing}', {})).toBe('{missing}')
  })

  it('falls back to the key when a string is absent', () => {
    expect(createFallbackTranslate()('nope.nothing')).toBe('nope.nothing')
  })

  it('lets a host override individual strings', () => {
    expect(createFallbackTranslate({ 'copilot.dock.title': 'Aura' })('copilot.dock.title')).toBe(
      'Aura',
    )
  })
})

describe('theme tokens', () => {
  it('maps tokens onto CSS custom properties', () => {
    const style = themeToCssVars({ accent: '#111', radius: '4px', colorScheme: 'dark' }) as Record<
      string,
      string
    >
    expect(style['--nxcp-accent']).toBe('#111')
    expect(style['--nxcp-radius']).toBe('4px')
    expect(style.colorScheme).toBe('dark')
  })

  it('skips tokens the host did not set', () => {
    expect(Object.keys(themeToCssVars({}))).toEqual([])
  })
})

describe('z-index scale', () => {
  it('clears the highest chrome viz-ui actually paints', () => {
    expect(COPILOT_Z_INDEX.dock).toBeGreaterThan(COPILOT_Z_INDEX_NOTES.vizUiMaxChrome)
  })

  it('stays below sonner so a toast is still readable over the dock', () => {
    for (const layer of Object.values(COPILOT_Z_INDEX)) {
      expect(layer).toBeLessThan(COPILOT_Z_INDEX_NOTES.sonnerToaster)
    }
  })

  it('orders the layers the way the concierge prototype does', () => {
    expect(COPILOT_Z_INDEX.dock).toBeLessThan(COPILOT_Z_INDEX.launcher)
    expect(COPILOT_Z_INDEX.launcher).toBeLessThan(COPILOT_Z_INDEX.popover)
    expect(COPILOT_Z_INDEX.popover).toBeLessThan(COPILOT_Z_INDEX.overlay)
  })
})

class RecordingTransport implements CopilotTransport {
  readonly name = 'sse' as const
  inputs: SendTurnInput[] = []

  async createTurn(input: SendTurnInput): Promise<CreatedTurn> {
    this.inputs.push(input)
    return { turnId: 't1' }
  }

  consumeRun(options: ConsumeRunOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      options.signal.addEventListener('abort', () => resolve(), { once: true })
    })
  }

  async cancelTurn(): Promise<void> {
    return Promise.resolve()
  }

  async respondToApproval(): Promise<void> {
    return Promise.resolve()
  }

  async listThreads() {
    return []
  }
}

function ComposerHarness({ transport }: { transport: CopilotTransport }) {
  return (
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters()}
      transport={transport}
    >
      <Composer />
    </CopilotProvider>
  )
}

describe('Composer', () => {
  it('sends on Enter and attaches the page scope', async () => {
    const transport = new RecordingTransport()
    render(<ComposerHarness transport={transport} />)
    const box = screen.getByLabelText('Message')

    fireEvent.change(box, { target: { value: 'why is AHU-1 offline?' } })
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' })
    })

    expect(transport.inputs).toHaveLength(1)
    expect(transport.inputs[0]?.prompt).toBe('why is AHU-1 offline?')
    expect(transport.inputs[0]?.scope).toMatchObject({ app: 'test-ui', organization_id: 7 })
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const transport = new RecordingTransport()
    render(<ComposerHarness transport={transport} />)
    const box = screen.getByLabelText('Message')
    fireEvent.change(box, { target: { value: 'line' } })
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    })
    expect(transport.inputs).toHaveLength(0)
  })

  it('keeps the send button disabled until there is something to send', () => {
    render(<ComposerHarness transport={new RecordingTransport()} />)
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false)
  })

  it('clears the box after sending', async () => {
    render(<ComposerHarness transport={new RecordingTransport()} />)
    const box = screen.getByLabelText('Message') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'x' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    })
    expect(box.value).toBe('')
  })

  it('offers a stop control while a run is in flight', async () => {
    const transport = new RecordingTransport()
    render(<ComposerHarness transport={transport} />)
    const box = screen.getByLabelText('Message')
    fireEvent.change(box, { target: { value: 'x' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    })
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
  })
})

describe('provider guards', () => {
  it('explains itself when a hook is used outside the provider', () => {
    const Orphan = () => {
      useCopilotEngine()
      return null
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Orphan />)).toThrow(/inside <CopilotProvider>/)
    spy.mockRestore()
  })
})
