import { describe, expect, it, vi } from 'vitest'

import { readSseStream, SseParser } from '../transport/sse'
import { encode, sseResponse } from './helpers'

describe('SseParser', () => {
  it('parses a single complete frame', () => {
    const parser = new SseParser()
    const out = parser.push('event: message_delta\ndata: {"text":"hi"}\n\n')
    expect(out).toEqual([{ event: 'message_delta', data: '{"text":"hi"}' }])
  })

  it('joins multiple data lines with a newline', () => {
    const parser = new SseParser()
    const out = parser.push('event: x\ndata: one\ndata: two\n\n')
    expect(out[0]?.data).toBe('one\ntwo')
  })

  it('strips exactly one leading space after the colon', () => {
    const parser = new SseParser()
    const out = parser.push('data:  padded\n\n')
    expect(out[0]?.data).toBe(' padded')
  })

  it('treats a field with no colon as an empty value', () => {
    const parser = new SseParser()
    const out = parser.push('event\ndata: body\n\n')
    expect(out[0]?.event).toBe('message')
  })

  it('ignores comment lines, which are the keep-alive pings', () => {
    const parser = new SseParser()
    expect(parser.push(': ping\n')).toEqual([])
    expect(parser.push(': ping\n\n')).toEqual([])
    const out = parser.push('event: done\ndata: {}\n\n')
    expect(out).toHaveLength(1)
  })

  it('reassembles a frame split across arbitrary chunk boundaries', () => {
    const parser = new SseParser()
    const wire = 'event: message_delta\ndata: {"text":"hello"}\n\n'
    const collected = []
    for (const char of wire) collected.push(...parser.push(char))
    expect(collected).toEqual([{ event: 'message_delta', data: '{"text":"hello"}' }])
  })

  it('handles CRLF terminators', () => {
    const parser = new SseParser()
    const out = parser.push('event: done\r\ndata: {}\r\n\r\n')
    expect(out).toEqual([{ event: 'done', data: '{}' }])
  })

  it('holds back a trailing CR in case it is half of a CRLF', () => {
    const parser = new SseParser()
    expect(parser.push('data: a\r')).toEqual([])
    expect(parser.push('\n\n')).toEqual([{ event: 'message', data: 'a' }])
  })

  it('treats a lone CR as a terminator, still holding the final one back', () => {
    const parser = new SseParser()
    // The closing CR is the last byte in the buffer, so it stays held until more arrives.
    expect(parser.push('data: a\rdata: b\r\r')).toEqual([])
    expect(parser.push('x')).toEqual([{ event: 'message', data: 'a\nb' }])
  })

  it('tracks the last event id and carries it onto later frames', () => {
    const parser = new SseParser()
    const first = parser.push('id: 7\nevent: a\ndata: {}\n\n')
    expect(first[0]?.id).toBe('7')
    expect(parser.getLastEventId()).toBe('7')
    const second = parser.push('event: b\ndata: {}\n\n')
    expect(second[0]?.id).toBe('7')
  })

  it('ignores an id containing a NUL, per the spec', () => {
    const parser = new SseParser()
    parser.push('id: bad\u0000id\nevent: a\ndata: {}\n\n')
    expect(parser.getLastEventId()).toBeUndefined()
  })

  it('advances the resume cursor on an id-only frame that carries no data', () => {
    const parser = new SseParser()
    expect(parser.push('id: 12\n\n')).toEqual([])
    expect(parser.getLastEventId()).toBe('12')
  })

  it('records a retry hint as a number', () => {
    const parser = new SseParser()
    const out = parser.push('retry: 2500\ndata: {}\n\n')
    expect(out[0]?.retryMs).toBe(2500)
  })

  it('ignores a non-integer retry hint', () => {
    const parser = new SseParser()
    const out = parser.push('retry: soon\ndata: {}\n\n')
    expect(out[0]?.retryMs).toBeUndefined()
  })

  it('flushes a frame that never received its terminating blank line', () => {
    const parser = new SseParser()
    expect(parser.push('event: done\ndata: {}\n')).toEqual([])
    expect(parser.flush()).toEqual([{ event: 'done', data: '{}' }])
  })

  it('emits nothing when flushing an empty parser', () => {
    expect(new SseParser().flush()).toEqual([])
  })

  it('lets the resume cursor be seeded from outside', () => {
    const parser = new SseParser()
    parser.setLastEventId('99')
    const out = parser.push('event: a\ndata: {}\n\n')
    expect(out[0]?.id).toBe('99')
  })
})

describe('readSseStream', () => {
  it('delivers every frame in order', async () => {
    const response = sseResponse(['event: a\ndata: 1\n\n', 'event: b\ndata: 2\n\n'])
    const seen: string[] = []
    await readSseStream(response.body as ReadableStream<Uint8Array>, (frame) =>
      seen.push(frame.event),
    )
    expect(seen).toEqual(['a', 'b'])
  })

  it('reassembles a multi-byte character split across chunks', async () => {
    const bytes = encode('data: café\n\n')
    const first = bytes.slice(0, 10)
    const second = bytes.slice(10)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first)
        controller.enqueue(second)
        controller.close()
      },
    })
    const seen: string[] = []
    await readSseStream(body, (frame) => seen.push(frame.data))
    expect(seen).toEqual(['café'])
  })

  it('stops reading once the signal aborts', async () => {
    const controller = new AbortController()
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encode('event: a\ndata: 1\n\n'))
        streamController.enqueue(encode('event: b\ndata: 2\n\n'))
        streamController.close()
      },
    })
    const seen: string[] = []
    await readSseStream(
      body,
      (frame) => {
        seen.push(frame.event)
        controller.abort()
      },
      { signal: controller.signal },
    )
    expect(seen).toEqual(['a'])
  })

  it('releases the reader lock even when the consumer throws', async () => {
    const response = sseResponse(['event: a\ndata: 1\n\n'])
    const body = response.body as ReadableStream<Uint8Array>
    const onFrame = vi.fn(() => {
      throw new Error('boom')
    })
    await expect(readSseStream(body, onFrame)).rejects.toThrow('boom')
    // A leaked lock would make this throw instead of resolving.
    expect(() => body.getReader()).not.toThrow()
  })
})
