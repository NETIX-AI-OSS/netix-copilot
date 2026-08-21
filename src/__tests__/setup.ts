import { ReadableStream as NodeReadableStream } from 'node:stream/web'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not ship the streams API, and the SSE reader is built on it.
if (typeof globalThis.ReadableStream === 'undefined') {
  ;(globalThis as unknown as { ReadableStream: unknown }).ReadableStream = NodeReadableStream
}

afterEach(() => {
  cleanup()
})
