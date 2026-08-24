import { ReadableStream as NodeReadableStream } from 'node:stream/web'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not ship the streams API, and the SSE reader is built on it.
if (typeof globalThis.ReadableStream === 'undefined') {
  ;(globalThis as unknown as { ReadableStream: unknown }).ReadableStream = NodeReadableStream
}

if (typeof window.localStorage === 'undefined') {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return values.size
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    },
  })
}

afterEach(() => {
  cleanup()
})
