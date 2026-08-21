// A hand-rolled Server-Sent Events parser.
// Native EventSource is unusable here: it cannot set an Authorization header and the gateway's
// ext_authz filter reads only that header, with no cookie fallback. So we read fetch() bodies
// as a ReadableStream and parse the wire format ourselves.

export interface SseFrame {
  event: string
  data: string
  id?: string
  retryMs?: number
}

const FIELD_SEPARATOR = ':'
const NUL = '\u0000'
const LF = '\n'
const CR = '\r'

// Incremental parser. Feed it decoded text as it arrives, it returns whole frames only.
export class SseParser {
  private buffer = ''
  private dataLines: string[] = []
  private eventName = ''
  private lastId: string | undefined
  private frameId: string | undefined
  private retryMs: number | undefined
  private sawFrameId = false

  // Feed a chunk of decoded text, receive every frame completed by it.
  push(chunk: string): SseFrame[] {
    this.buffer += chunk
    const frames: SseFrame[] = []
    let lineEnd = this.nextLineEnd()
    while (lineEnd !== null) {
      const line = this.buffer.slice(0, lineEnd.index)
      this.buffer = this.buffer.slice(lineEnd.index + lineEnd.length)
      const frame = this.consumeLine(line)
      if (frame) frames.push(frame)
      lineEnd = this.nextLineEnd()
    }
    return frames
  }

  // Flush a trailing frame that arrived without its terminating blank line.
  flush(): SseFrame[] {
    const frames: SseFrame[] = []
    if (this.buffer.length > 0) {
      const line = this.buffer
      this.buffer = ''
      const frame = this.consumeLine(line)
      if (frame) frames.push(frame)
    }
    const tail = this.dispatch()
    if (tail) frames.push(tail)
    return frames
  }

  // The id of the last frame that carried one, for Last-Event-ID on resume.
  getLastEventId(): string | undefined {
    return this.lastId
  }

  setLastEventId(id: string | undefined): void {
    this.lastId = id
  }

  // A CR at the very end of the buffer is held back: it may be the first half of a CRLF.
  private nextLineEnd(): { index: number; length: number } | null {
    for (let i = 0; i < this.buffer.length; i += 1) {
      const char = this.buffer[i]
      if (char === LF) return { index: i, length: 1 }
      if (char === CR) {
        if (i === this.buffer.length - 1) return null
        return this.buffer[i + 1] === LF ? { index: i, length: 2 } : { index: i, length: 1 }
      }
    }
    return null
  }

  private consumeLine(line: string): SseFrame | null {
    if (line === '') return this.dispatch()
    // A line beginning with a colon is a comment. Servers send these as keep-alive pings.
    if (line.startsWith(FIELD_SEPARATOR)) return null

    const colon = line.indexOf(FIELD_SEPARATOR)
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    switch (field) {
      case 'event':
        this.eventName = value
        break
      case 'data':
        this.dataLines.push(value)
        break
      case 'id':
        // Per the SSE spec an id containing a NUL is ignored outright.
        if (!value.includes(NUL)) {
          this.frameId = value
          this.sawFrameId = true
        }
        break
      case 'retry': {
        const parsed = Number(value)
        if (Number.isInteger(parsed) && parsed >= 0) this.retryMs = parsed
        break
      }
      default:
        break
    }
    return null
  }

  private dispatch(): SseFrame | null {
    if (this.dataLines.length === 0) {
      // An id-only frame still advances the resume cursor but carries no payload.
      if (this.sawFrameId) this.lastId = this.frameId
      this.resetFrame()
      return null
    }
    const frame: SseFrame = {
      event: this.eventName === '' ? 'message' : this.eventName,
      data: this.dataLines.join(LF),
    }
    if (this.sawFrameId) {
      this.lastId = this.frameId
      frame.id = this.frameId
    } else if (this.lastId !== undefined) {
      frame.id = this.lastId
    }
    if (this.retryMs !== undefined) frame.retryMs = this.retryMs
    this.resetFrame()
    return frame
  }

  private resetFrame(): void {
    this.dataLines = []
    this.eventName = ''
    this.frameId = undefined
    this.sawFrameId = false
  }
}

// Drive a fetch response body through the parser, invoking onFrame for each complete frame.
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: SseFrame) => void,
  options: { parser?: SseParser; signal?: AbortSignal } = {},
): Promise<void> {
  const parser = options.parser ?? new SseParser()
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')

  const abort = () => {
    // cancel() rejects if the stream is already errored, which is not interesting here.
    void reader.cancel().catch(() => undefined)
  }
  options.signal?.addEventListener('abort', abort, { once: true })

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (options.signal?.aborted) break
      const text = decoder.decode(value, { stream: true })
      if (text.length === 0) continue
      for (const frame of parser.push(text)) onFrame(frame)
    }
    if (!options.signal?.aborted) {
      const tail = decoder.decode()
      if (tail.length > 0) {
        for (const frame of parser.push(tail)) onFrame(frame)
      }
      for (const frame of parser.flush()) onFrame(frame)
    }
  } finally {
    options.signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}
