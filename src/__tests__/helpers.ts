import type { CopilotAdapters } from '../adapters/types'
import { createFallbackTranslate } from '../ui/i18n'

export function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

// Build a Response whose body streams the supplied chunks, one enqueue per chunk.
export function sseResponse(chunks: string[], init: ResponseInit = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encode(chunk))
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream', ...(init.headers ?? {}) }),
    body,
    text: async () => chunks.join(''),
  } as unknown as Response
}

export function jsonResponse(payload: unknown, status = 200): Response {
  const text = JSON.stringify(payload)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: null,
    text: async () => text,
  } as unknown as Response
}

export function errorResponse(status: number, body = ''): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: null,
    text: async () => body,
  } as unknown as Response
}

export function frames(...events: Array<{ event: string; data: unknown; id?: string }>): string[] {
  return events.map((entry) => {
    const id = entry.id === undefined ? '' : `id: ${entry.id}\n`
    return `${id}event: ${entry.event}\ndata: ${JSON.stringify(entry.data)}\n\n`
  })
}

export function testAdapters(overrides: Partial<CopilotAdapters> = {}): CopilotAdapters {
  return {
    pageContext: {
      app: 'test-ui',
      route: '/assets/17',
      routeParams: { assetId: '17' },
      searchParams: { tab: 'health' },
      user: { id: 42, organizationId: 7, name: 'Test User' },
      entity: { type: 'asset', id: 17, label: 'AHU-1' },
    },
    renderChart: () => null,
    hasPermission: () => true,
    t: createFallbackTranslate(),
    theme: { colorScheme: 'light', accent: '#2f6df6' },
    ...overrides,
  }
}

// A sleep that resolves immediately, so poll loops run at full speed under test.
export const instantSleep = async (): Promise<void> => Promise.resolve()
