import { describe, expect, it, vi } from 'vitest'

import type { CopilotEngineState, OnlineSource } from '../runtime/engine'
import { browserOnlineSource, CopilotEngine } from '../runtime/engine'
import type { ConsumeRunOptions, CopilotTransport, CreatedTurn } from '../transport/types'
import { StreamInterruptedError } from '../transport/types'
import type { EnvelopedEvent, SendTurnInput } from '../types'

// A transport whose runs are driven by the test rather than by a clock.
class FakeTransport implements CopilotTransport {
  readonly name = 'sse' as const

  createCalls: SendTurnInput[] = []
  consumeCalls: ConsumeRunOptions[] = []
  cancelled: string[] = []
  createResult: CreatedTurn = { turnId: 't1', threadId: 'th1' }
  createError: Error | undefined
  // Each consumeRun resolves through the promise the test settles.
  private pending: Array<{ resolve: () => void; reject: (error: unknown) => void }> = []

  async createTurn(input: SendTurnInput): Promise<CreatedTurn> {
    this.createCalls.push(input)
    if (this.createError) throw this.createError
    return this.createResult
  }

  consumeRun(options: ConsumeRunOptions): Promise<void> {
    this.consumeCalls.push(options)
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ resolve, reject })
      options.signal.addEventListener('abort', () => resolve(), { once: true })
    })
  }

  async cancelTurn(turnId: string): Promise<void> {
    this.cancelled.push(turnId)
  }

  async respondToApproval(): Promise<void> {
    return Promise.resolve()
  }

  async listThreads() {
    return []
  }

  emit(enveloped: EnvelopedEvent, index = this.consumeCalls.length - 1): void {
    this.consumeCalls[index]?.onEvent(enveloped)
  }

  finish(index = this.pending.length - 1): void {
    this.pending[index]?.resolve()
  }

  fail(error: unknown, index = this.pending.length - 1): void {
    this.pending[index]?.reject(error)
  }
}

class FakeOnline implements OnlineSource {
  private online = true
  private listeners = new Set<(online: boolean) => void>()

  isOnline(): boolean {
    return this.online
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  set(online: boolean): void {
    this.online = online
    for (const listener of this.listeners) listener(online)
  }
}

function makeEngine(overrides = {}) {
  const transport = new FakeTransport()
  const online = new FakeOnline()
  const engine = new CopilotEngine({
    transport,
    onlineSource: online,
    teardownGraceMs: 10,
    resumeDelayMs: 0,
    ...overrides,
  })
  return { engine, transport, online }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

// The resume path schedules its backoff inside a rejection handler, so it needs more than one
// macrotask to come back around.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('CopilotEngine idle behaviour', () => {
  it('opens no connection just by existing', () => {
    const { transport } = makeEngine()
    expect(transport.createCalls).toHaveLength(0)
    expect(transport.consumeCalls).toHaveLength(0)
  })

  it('opens no connection when surfaces mount and unmount', () => {
    const { engine, transport } = makeEngine()
    engine.retain()
    engine.retain()
    engine.release()
    engine.release()
    expect(transport.consumeCalls).toHaveLength(0)
  })

  it('starts exactly one run per send', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('hello')
    expect(transport.createCalls).toHaveLength(1)
    expect(transport.consumeCalls).toHaveLength(1)
  })

  it('ignores an empty or whitespace-only prompt', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('   ')
    expect(transport.createCalls).toHaveLength(0)
  })

  it('refuses a second send while a run is still streaming', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('one')
    transport.emit({ event: { type: 'run_started', turnId: 't1' } })
    await engine.send('two')
    expect(transport.createCalls).toHaveLength(1)
  })

  it('accepts the next send once the run is done', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('one')
    transport.emit({ event: { type: 'done' } })
    transport.finish()
    await flush()
    await engine.send('two')
    expect(transport.createCalls).toHaveLength(2)
  })
})

describe('CopilotEngine state', () => {
  it('notifies subscribers and hands out a fresh snapshot', async () => {
    const { engine, transport } = makeEngine()
    const seen: CopilotEngineState[] = []
    engine.subscribe(() => seen.push(engine.getSnapshot()))
    await engine.send('hello')
    transport.emit({ event: { type: 'message_delta', text: 'hi' } })
    expect(seen.length).toBeGreaterThan(1)
    expect(engine.getSnapshot().turns[0]?.run.text).toBe('hi')
  })

  it('stops notifying after unsubscribe', async () => {
    const { engine, transport } = makeEngine()
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)
    unsubscribe()
    await engine.send('hello')
    transport.emit({ event: { type: 'message_delta', text: 'hi' } })
    expect(listener).not.toHaveBeenCalled()
  })

  it('records the prompt as a turn immediately, before the backend answers', async () => {
    const { engine } = makeEngine()
    const pending = engine.send('why is AHU-1 offline?')
    expect(engine.getSnapshot().turns[0]?.prompt).toBe('why is AHU-1 offline?')
    await pending
  })

  it('reports the transport that was actually used', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('hello')
    transport.consumeCalls[0]?.onTransportChange?.('agentic')
    expect(engine.getSnapshot().transport).toBe('agentic')
  })

  it('turns a failed create into an error event on the turn', async () => {
    const { engine, transport } = makeEngine()
    transport.createError = new Error('ml-engine unreachable')
    await engine.send('hello')
    const run = engine.getSnapshot().turns[0]?.run
    expect(run?.status).toBe('error')
    expect(run?.error?.message).toBe('ml-engine unreachable')
    expect(transport.consumeCalls).toHaveLength(0)
  })

  it('keeps the thread id so a follow-up continues the same conversation', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('one')
    expect(engine.getSnapshot().threadId).toBe('th1')
    transport.emit({ event: { type: 'done' } })
    transport.finish()
    await flush()
    await engine.send('two')
    expect(transport.createCalls[1]?.threadId).toBe('th1')
  })

  it('clears the conversation on startNewThread', async () => {
    const { engine } = makeEngine()
    await engine.send('one')
    engine.startNewThread()
    const state = engine.getSnapshot()
    expect(state.turns).toEqual([])
    expect(state.threadId).toBeUndefined()
  })

  it('switches conversation on selectThread', async () => {
    const { engine } = makeEngine()
    await engine.send('one')
    engine.selectThread('other')
    expect(engine.getSnapshot()).toMatchObject({ threadId: 'other', turns: [] })
  })
})

describe('CopilotEngine cancellation', () => {
  it('aborts the reader and marks the run cancelled', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('hello')
    transport.emit({ event: { type: 'run_started', turnId: 't1' } })
    engine.cancel()
    expect(transport.consumeCalls[0]?.signal.aborted).toBe(true)
    expect(engine.getSnapshot().turns[0]?.run.status).toBe('cancelled')
  })

  it('tells the backend to cancel the turn it knows about', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('hello')
    transport.emit({ event: { type: 'run_started', turnId: 't1' } })
    engine.cancel()
    await flush()
    expect(transport.cancelled).toEqual(['t1'])
  })

  it('does nothing when there is no active run', () => {
    const { engine, transport } = makeEngine()
    engine.cancel()
    expect(transport.cancelled).toEqual([])
  })
})

describe('CopilotEngine teardown grace', () => {
  it('keeps a live run alive across a StrictMode unmount and remount', async () => {
    const { engine, transport } = makeEngine({ teardownGraceMs: 20 })
    engine.retain()
    await engine.send('hello')
    // The StrictMode cycle: cleanup then effect, back to back.
    engine.release()
    engine.retain()
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(transport.consumeCalls[0]?.signal.aborted).toBe(false)
  })

  it('stops the run when the last surface really goes away', async () => {
    const { engine, transport } = makeEngine({ teardownGraceMs: 5 })
    engine.retain()
    await engine.send('hello')
    engine.release()
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(transport.consumeCalls[0]?.signal.aborted).toBe(true)
  })
})

describe('CopilotEngine offline handling', () => {
  it('pauses rather than failing when the browser goes offline', async () => {
    const { engine, transport, online } = makeEngine()
    await engine.send('hello')
    transport.emit({ event: { type: 'message_delta', text: 'partial' }, id: 'e-3' })
    online.set(false)

    const run = engine.getSnapshot().turns[0]?.run
    expect(run?.status).toBe('paused')
    expect(run?.offline).toBe(true)
    expect(transport.consumeCalls[0]?.signal.aborted).toBe(true)
  })

  it('resumes from the last event id when the connection returns', async () => {
    const { engine, transport, online } = makeEngine()
    await engine.send('hello')
    transport.emit({ event: { type: 'run_started', turnId: 't1' } })
    transport.emit({ event: { type: 'message_delta', text: 'partial' }, id: 'e-3' })
    online.set(false)
    online.set(true)
    await flush()

    expect(transport.consumeCalls).toHaveLength(2)
    expect(transport.consumeCalls[1]?.lastEventId).toBe('e-3')
    expect(engine.getSnapshot().turns[0]?.run.status).toBe('streaming')
  })

  it('does not reconnect when coming back online with no run in flight', async () => {
    const { engine, transport, online } = makeEngine()
    await engine.send('hello')
    transport.emit({ event: { type: 'done' } })
    transport.finish()
    await flush()
    online.set(false)
    online.set(true)
    await flush()
    expect(transport.consumeCalls).toHaveLength(1)
  })

  it('tracks connectivity in the snapshot', () => {
    const { engine, online } = makeEngine()
    expect(engine.getSnapshot().online).toBe(true)
    online.set(false)
    expect(engine.getSnapshot().online).toBe(false)
  })
})

describe('CopilotEngine stream resumption', () => {
  it('retries from the cursor when the socket drops mid-run', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('hello')
    transport.fail(new StreamInterruptedError('e-7'))
    await settle()
    expect(transport.consumeCalls).toHaveLength(2)
    expect(transport.consumeCalls[1]?.lastEventId).toBe('e-7')
  })

  it('gives up with an error after the retry budget is spent', async () => {
    const { engine, transport } = makeEngine({ maxResumeAttempts: 1 })
    await engine.send('hello')
    transport.fail(new StreamInterruptedError('e-1'))
    await settle()
    expect(transport.consumeCalls).toHaveLength(2)
    transport.fail(new StreamInterruptedError('e-2'))
    await settle()
    expect(engine.getSnapshot().turns[0]?.run.status).toBe('error')
    expect(engine.getSnapshot().turns[0]?.run.error?.retryable).toBe(true)
  })

  it('does not retry after the caller aborted', async () => {
    const { engine, transport } = makeEngine()
    await engine.send('hello')
    engine.cancel()
    await flush()
    expect(transport.consumeCalls).toHaveLength(1)
  })
})

describe('CopilotEngine disposal', () => {
  it('aborts work and drops listeners', async () => {
    const { engine, transport } = makeEngine()
    const listener = vi.fn()
    engine.subscribe(listener)
    await engine.send('hello')
    engine.dispose()
    expect(transport.consumeCalls[0]?.signal.aborted).toBe(true)
    listener.mockClear()
    engine.dispose()
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('browserOnlineSource', () => {
  it('reads navigator.onLine and reacts to window events', () => {
    const source = browserOnlineSource()
    expect(source.isOnline()).toBe(true)
    const seen: boolean[] = []
    const unsubscribe = source.subscribe((online) => seen.push(online))
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
    unsubscribe()
    window.dispatchEvent(new Event('offline'))
    expect(seen).toEqual([false, true])
  })
})
