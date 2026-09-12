// The copilot engine: an external store that owns every network connection.
//
// Three hard rules are enforced here rather than in the components.
//
// 1. An idle dock holds no open connection. A stream is opened by send(); restoring a live turn
//    polls its authoritative row until it reaches a terminal state.
//    Mounting the dock only adds a listener. ml-engine runs one replica with two uvicorn workers
//    and the shared ingress caps concurrent connections per IP across all eleven API hosts, so a
//    permanently connected dock on every tab would not survive a busy office.
// 2. React StrictMode cannot double-subscribe. State lives outside React and is read through
//    useSyncExternalStore, so a double mount adds and removes a listener and nothing else.
//    Teardown is deferred by a grace period so the mount/unmount/mount cycle cannot kill a run.
// 3. Going offline suspends the reader instead of failing the run, and coming back resumes from
//    Last-Event-ID rather than replaying the answer from the top.

import type { CopilotTransport, ThreadPatch, TransportName } from '../transport/types'
import { newIdempotencyKey, StreamInterruptedError } from '../transport/types'
import type {
  CopilotEvent,
  CopilotLifecycleEvent,
  CopilotThread,
  EnvelopedEvent,
  JsonObject,
  ModelTier,
  RunState,
  SendTurnInput,
} from '../types'
import { applyEnveloped, initialRunState, isRunActive } from './run-store'

export interface CopilotTurnView {
  id: string
  // What the transcript shows. Authoritative for display, always.
  prompt: string
  createdAt: number
  run: RunState
  // Set only when the host rewrote the prompt for the wire, so the difference is inspectable
  // without ever being rendered.
  wirePrompt?: string
}

// What actually goes on the wire, when a host needs it to differ from what the user sees.
export interface CopilotSendOptions {
  wireText?: string
  contextIncluded?: boolean
}

export interface CopilotEngineState {
  threadId?: string
  turns: CopilotTurnView[]
  transport?: TransportName
  // True between calling send() and the create request resolving.
  sending: boolean
  online: boolean
  threads: CopilotThread[]
  threadsLoaded: boolean
  // True while a selected thread's transcript is being fetched.
  threadLoading: boolean
  threadReadOnly: boolean
  modelTier: ModelTier
  modelTierLocked: boolean
  // Whether the next send folds the host page context into the prompt. The composer's context
  // chip toggles it; hosts read it through CopilotPromptContext.includeContext.
  contextEnabled: boolean
}

export interface OnlineSource {
  isOnline(): boolean
  subscribe(listener: (online: boolean) => void): () => void
}

export interface CopilotLogger {
  warn(message: string, detail?: unknown): void
  error(message: string, detail?: unknown): void
}

export interface CopilotEngineOptions {
  transport: CopilotTransport
  // How long to wait after the last release() before stopping work. Must stay above zero so
  // StrictMode's synchronous unmount/remount cannot tear down a live run.
  teardownGraceMs?: number
  maxResumeAttempts?: number
  resumeDelayMs?: number
  onlineSource?: OnlineSource
  logger?: CopilotLogger
  now?: () => number
  setTimeoutImpl?: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeoutImpl?: (handle: ReturnType<typeof setTimeout>) => void
  conversationSurface?: 'web' | 'mobile' | 'embed' | 'api'
  slowRunThresholdMs?: number
  onLifecycleEvent?: (event: CopilotLifecycleEvent) => void
}

export function browserOnlineSource(): OnlineSource {
  return {
    isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
    subscribe: (listener) => {
      if (typeof window === 'undefined') return () => undefined
      const onOnline = () => listener(true)
      const onOffline = () => listener(false)
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
      return () => {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      }
    },
  }
}

const DEFAULT_TEARDOWN_GRACE_MS = 250
const DEFAULT_MAX_RESUME_ATTEMPTS = 3
const DEFAULT_RESUME_DELAY_MS = 750
const DEFAULT_SLOW_RUN_THRESHOLD_MS = 10_000

export class CopilotEngine {
  private readonly options: CopilotEngineOptions
  private readonly listeners = new Set<() => void>()
  private readonly now: () => number
  private readonly schedule: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>
  private readonly unschedule: (handle: ReturnType<typeof setTimeout>) => void

  private snapshot: CopilotEngineState
  private controller: AbortController | undefined
  private refCount = 0
  private teardownHandle: ReturnType<typeof setTimeout> | undefined
  private unsubscribeOnline: (() => void) | undefined
  private disposed = false
  private localTurnSeq = 0
  private threadSeq = 0
  // Where the server said to read the active run. Kept so a resume tails the URL it handed back.
  private activeStreamUrl: string | undefined
  private activePollUrl: string | undefined
  private activeRestoredState: RunState | undefined
  private activeSlowHandle: ReturnType<typeof setTimeout> | undefined
  private readonly liveTurnIds = new Set<string>()
  private readonly cancelAfterCreate = new Set<number>()
  private dockMode: 'min' | 'dock' | 'full' = 'min'

  constructor(options: CopilotEngineOptions) {
    this.options = options
    this.now = options.now ?? (() => Date.now())
    this.schedule = options.setTimeoutImpl ?? ((handler, ms) => setTimeout(handler, ms))
    this.unschedule = options.clearTimeoutImpl ?? ((handle) => clearTimeout(handle))
    const onlineSource = options.onlineSource ?? browserOnlineSource()
    this.snapshot = {
      turns: [],
      sending: false,
      online: onlineSource.isOnline(),
      threads: [],
      threadsLoaded: false,
      threadLoading: false,
      threadReadOnly: false,
      modelTier: 'base',
      modelTierLocked: false,
      contextEnabled: true,
    }
    this.unsubscribeOnline = onlineSource.subscribe((online) => this.handleConnectivity(online))
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): CopilotEngineState => this.snapshot

  // Mounting a surface retains the engine; the last release stops any work after a grace period.
  retain(): void {
    this.refCount += 1
    if (this.teardownHandle !== undefined) {
      this.unschedule(this.teardownHandle)
      this.teardownHandle = undefined
    }
  }

  release(): void {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0 || this.teardownHandle !== undefined) return
    const grace = this.options.teardownGraceMs ?? DEFAULT_TEARDOWN_GRACE_MS
    this.teardownHandle = this.schedule(() => {
      this.teardownHandle = undefined
      if (this.refCount === 0) {
        this.stopTrackingActiveRun()
        this.abortActiveRun()
      }
    }, grace)
  }

  get activeRun(): RunState | undefined {
    const last = this.snapshot.turns[this.snapshot.turns.length - 1]
    return last?.run
  }

  get isStreaming(): boolean {
    const run = this.activeRun
    return run !== undefined && isRunActive(run)
  }

  // `prompt` is what the transcript shows. `options.wireText` is what the backend receives when
  // the host had to append something the user must not see -- a scope hint, for instance, which
  // the agentic contract has no field for.
  async send(prompt: string, scope?: JsonObject, options?: CopilotSendOptions): Promise<void> {
    const trimmed = prompt.trim()
    if (trimmed === '' || this.snapshot.threadReadOnly || this.snapshot.sending || this.isStreaming)
      return

    const wireText = options?.wireText?.trim()
    const wire = wireText === undefined || wireText === '' ? trimmed : wireText
    this.localTurnSeq += 1
    const turn: CopilotTurnView = {
      id: `local-${this.localTurnSeq}`,
      prompt: trimmed,
      createdAt: this.now(),
      run: { ...initialRunState(), status: 'creating' },
      ...(wire === trimmed ? {} : { wirePrompt: wire }),
    }
    this.update({ turns: [...this.snapshot.turns, turn], sending: true })
    this.emitLifecycle({
      type: 'message_sent',
      ...(this.snapshot.threadId === undefined ? {} : { threadId: this.snapshot.threadId }),
      modelTier: this.snapshot.modelTier,
      surface: this.options.conversationSurface ?? 'web',
      contextIncluded: options?.contextIncluded ?? scope !== undefined,
    })

    // Minted once per user send, so any retry of this send replays server-side instead of spending again.
    const input: SendTurnInput = {
      prompt: wire,
      idempotencyKey: newIdempotencyKey(),
      modelTier: this.snapshot.modelTier,
      surface: this.options.conversationSurface ?? 'web',
    }
    if (this.snapshot.threadId !== undefined) input.threadId = this.snapshot.threadId
    if (scope !== undefined) input.scope = scope

    // A thread opened while the create is in flight owns the panel; this turn is not on it.
    const token = this.threadSeq
    let created
    try {
      created = await this.options.transport.createTurn(input)
    } catch (error) {
      this.cancelAfterCreate.delete(token)
      if (token !== this.threadSeq) return
      this.update({ sending: false, modelTierLocked: this.snapshot.threadId !== undefined })
      this.pushEvent({
        type: 'error',
        error: { message: describeError(error), retryable: true },
      })
      this.emitLifecycle({
        type: 'run_failed',
        ...(this.snapshot.threadId === undefined ? {} : { threadId: this.snapshot.threadId }),
        modelTier: this.snapshot.modelTier,
      })
      return
    }
    const cancellationRequested = this.cancelAfterCreate.delete(token)
    if (token !== this.threadSeq) {
      if (cancellationRequested) {
        void this.options.transport.cancelTurn(created.turnId).catch((error: unknown) => {
          this.options.logger?.warn('netix-copilot: late-created turn cancellation failed', error)
        })
      }
      this.options.logger?.warn('netix-copilot: turn created after the thread changed; dropped', {
        turnId: created.turnId,
      })
      return
    }

    this.update({
      sending: false,
      threadId: created.threadId ?? this.snapshot.threadId ?? created.turnId,
      modelTier: created.modelTier ?? this.snapshot.modelTier,
      modelTierLocked: true,
    })
    this.patchActiveRun({ turnId: created.turnId })
    this.liveTurnIds.add(created.turnId)
    this.activeStreamUrl = created.streamUrl
    this.activePollUrl = created.pollUrl
    this.activeRestoredState = undefined
    this.startSlowTimer(created.turnId, token)
    void this.consume(created.turnId, undefined, created.streamUrl, created.pollUrl, token)
    if (cancellationRequested || this.activeRun?.cancellation?.status === 'requested') {
      void this.requestCancellation(created.turnId, token)
    }
  }

  cancel(): void {
    if (this.snapshot.threadReadOnly) return
    const run = this.activeRun
    if (!run || !isRunActive(run) || run.cancellation?.status === 'requested') return
    this.patchActiveRun({ cancellation: { status: 'requested' } })
    if (run.turnId !== undefined) void this.requestCancellation(run.turnId, this.threadSeq)
    else this.cancelAfterCreate.add(this.threadSeq)
  }

  recordDockMode(mode: 'min' | 'dock' | 'full'): void {
    const previous = this.dockMode
    this.dockMode = mode
    if (previous === 'min' && mode !== 'min') this.emitLifecycle({ type: 'dock_opened', mode })
  }

  async approve(stepId: string, approved: boolean): Promise<void> {
    if (this.snapshot.threadReadOnly) return
    const turnId = this.activeRun?.turnId
    if (turnId === undefined) return
    await this.options.transport.respondToApproval(turnId, stepId, approved)
  }

  startNewThread(): void {
    this.stopTrackingActiveRun()
    this.abortActiveRun()
    this.forgetRunUrls()
    // Bumped so a transcript fetch still in flight cannot land on the empty new thread.
    this.threadSeq += 1
    this.update({
      turns: [],
      sending: false,
      threadLoading: false,
      threadReadOnly: false,
      modelTier: 'base',
      modelTierLocked: false,
    })
    const next = { ...this.snapshot }
    delete next.threadId
    this.snapshot = next
    this.notify()
  }

  // Kept void-returning so a click handler stays a click handler. Await loadThread when the
  // transcript itself is what the caller is waiting on.
  selectThread(threadId: string): void {
    void this.loadThread(threadId)
  }

  // Point the engine at a stored thread and rebuild its history, so a deep link or a sidebar
  // click restores the plan, the charts and the result tables rather than an empty panel.
  async loadThread(threadId: string): Promise<void> {
    // Re-selecting the open thread is a mis-click, not a reload: it must not drop a live run.
    if (threadId === this.snapshot.threadId && this.snapshot.turns.length > 0) return
    this.stopTrackingActiveRun()
    this.abortActiveRun()
    this.forgetRunUrls()
    this.threadSeq += 1
    const token = this.threadSeq
    const fetchThread = this.options.transport.fetchThread
    this.update({
      threadId,
      turns: [],
      sending: false,
      threadLoading: fetchThread !== undefined,
      threadReadOnly: false,
    })
    if (fetchThread === undefined) return
    try {
      const accessRequest = this.options.transport.fetchThreadAccess?.call(
        this.options.transport,
        threadId,
      )
      const [turns, access] = await Promise.all([
        fetchThread.call(this.options.transport, threadId),
        accessRequest ?? Promise.resolve({ readOnly: false }),
      ])
      // A later selection, or a send that already started a new turn, owns the panel now.
      if (token !== this.threadSeq || this.snapshot.turns.length > 0) return
      const restoredTier = turns.find((turn) => turn.run.modelTier)?.run.modelTier ?? 'base'
      this.update({
        turns,
        threadLoading: false,
        threadReadOnly: access.readOnly,
        modelTier: restoredTier,
        modelTierLocked: true,
      })
      const restored = turns[turns.length - 1]?.run
      if (restored !== undefined && isRunActive(restored) && restored.turnId !== undefined) {
        this.activeRestoredState = restored
        if (this.snapshot.online) {
          void this.consume(
            restored.turnId,
            restored.lastEventId,
            undefined,
            undefined,
            token,
            restored,
          )
        } else {
          this.patchActiveRun({ status: 'paused', offline: true })
        }
      }
    } catch (error) {
      if (token !== this.threadSeq) return
      this.options.logger?.warn('netix-copilot: thread transcript unavailable', error)
      this.update({ threadLoading: false })
    }
  }

  async loadThreads(): Promise<void> {
    try {
      const threads = await this.options.transport.listThreads()
      this.update({ threads, threadsLoaded: true })
    } catch (error) {
      this.options.logger?.warn('netix-copilot: thread list unavailable', error)
      this.update({ threadsLoaded: true })
    }
  }

  setModelTier(tier: ModelTier): void {
    if (this.snapshot.modelTierLocked || this.snapshot.sending || this.isStreaming) return
    this.update({ modelTier: tier })
  }

  setContextEnabled(enabled: boolean): void {
    if (this.snapshot.contextEnabled === enabled) return
    this.update({ contextEnabled: enabled })
  }

  // Rename or pin a stored thread. The list updates first so the rail answers immediately, and
  // is put back if the backend refuses.
  async updateThread(threadId: string, patch: ThreadPatch): Promise<void> {
    if (this.threadIsReadOnly(threadId)) return
    const update = this.options.transport.updateThread
    if (update === undefined) return
    const previous = this.snapshot.threads
    this.update({
      threads: previous.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              ...(patch.title === undefined ? {} : { title: patch.title }),
              ...(patch.isPinned === undefined ? {} : { isPinned: patch.isPinned }),
            }
          : thread,
      ),
    })
    try {
      const saved = await update.call(this.options.transport, threadId, patch)
      this.update({
        threads: this.snapshot.threads.map((thread) => (thread.id === threadId ? saved : thread)),
      })
    } catch (error) {
      this.options.logger?.warn('netix-copilot: thread update failed', error)
      this.update({ threads: previous })
      throw error
    }
  }

  // Delete a stored thread. Deleting the open one empties the panel, exactly like New.
  async deleteThread(threadId: string): Promise<void> {
    if (this.threadIsReadOnly(threadId)) return
    const remove = this.options.transport.deleteThread
    if (remove === undefined) return
    await remove.call(this.options.transport, threadId)
    if (this.snapshot.threadId === threadId) this.startNewThread()
    this.update({ threads: this.snapshot.threads.filter((thread) => thread.id !== threadId) })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.teardownHandle !== undefined) {
      this.unschedule(this.teardownHandle)
      this.teardownHandle = undefined
    }
    this.stopTrackingActiveRun()
    this.abortActiveRun()
    this.unsubscribeOnline?.()
    this.unsubscribeOnline = undefined
    this.listeners.clear()
  }

  // Read the whole run to completion, resuming from the last seen event if the socket drops.
  private async consume(
    turnId: string,
    lastEventId: string | undefined,
    streamUrl?: string,
    pollUrl?: string,
    threadToken = this.threadSeq,
    restoredState?: RunState,
  ): Promise<void> {
    const controller = new AbortController()
    this.controller = controller
    let cursor = lastEventId
    let attempts = 0
    const maxAttempts = this.options.maxResumeAttempts ?? DEFAULT_MAX_RESUME_ATTEMPTS

    while (!controller.signal.aborted && !this.disposed) {
      try {
        await this.options.transport.consumeRun({
          turnId,
          signal: controller.signal,
          onEvent: (enveloped) => {
            if (
              threadToken === this.threadSeq &&
              this.controller === controller &&
              !controller.signal.aborted
            ) {
              this.pushEnveloped(enveloped)
            }
          },
          ...(cursor === undefined ? {} : { lastEventId: cursor }),
          ...(streamUrl === undefined ? {} : { streamUrl }),
          ...(pollUrl === undefined ? {} : { pollUrl }),
          ...(restoredState === undefined ? {} : { restoredState }),
          onTransportChange: (name) => {
            if (threadToken === this.threadSeq && this.snapshot.transport !== name) {
              this.update({ transport: name })
            }
          },
        })
        break
      } catch (error) {
        if (controller.signal.aborted || this.disposed) return
        cursor = resumeCursor(error) ?? this.activeRun?.lastEventId ?? cursor
        if (!this.snapshot.online) {
          // Offline is a pause, not a failure. handleConnectivity resumes from this cursor.
          this.patchActiveRun({ status: 'paused', offline: true })
          return
        }
        attempts += 1
        if (attempts > maxAttempts) {
          this.pushEvent({
            type: 'error',
            error: { message: describeError(error), retryable: true },
          })
          return
        }
        await this.delay((this.options.resumeDelayMs ?? DEFAULT_RESUME_DELAY_MS) * attempts)
      }
    }
    if (this.controller === controller) this.controller = undefined
  }

  private handleConnectivity(online: boolean): void {
    if (this.snapshot.online === online) return
    this.update({ online })
    const run = this.activeRun
    if (!run) return
    if (!online) {
      if (isRunActive(run)) {
        this.abortActiveRun()
        this.patchActiveRun({ status: 'paused', offline: true })
      }
      return
    }
    if (run.status === 'paused' && run.turnId !== undefined) {
      this.patchActiveRun({ status: 'streaming', offline: false })
      void this.consume(
        run.turnId,
        run.lastEventId,
        this.activeStreamUrl,
        this.activePollUrl,
        this.threadSeq,
        this.activeRestoredState,
      )
    }
  }

  private abortActiveRun(): void {
    this.controller?.abort()
    this.controller = undefined
  }

  private forgetRunUrls(): void {
    this.activeStreamUrl = undefined
    this.activePollUrl = undefined
    this.activeRestoredState = undefined
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.schedule(() => resolve(), ms)
    })
  }

  private pushEnveloped(enveloped: EnvelopedEvent): void {
    const turns = this.snapshot.turns
    if (turns.length === 0) return
    const index = turns.length - 1
    const current = turns[index]
    if (!current) return
    // An older backend stamps no start time on run_started; the elapsed counter still needs one.
    const event = enveloped.event
    const stamped: EnvelopedEvent =
      event.type === 'run_started' && event.startedAt === undefined
        ? { ...enveloped, event: { ...event, startedAt: this.now() } }
        : enveloped
    const nextRun = applyEnveloped(current.run, stamped)
    if (nextRun === current.run) return
    const nextTurns = turns.slice()
    nextTurns[index] = { ...current, run: nextRun }
    this.update({ turns: nextTurns })
    this.reportTerminalLifecycle(current.run, nextRun)
  }

  private pushEvent(event: CopilotEvent): void {
    this.pushEnveloped({ event })
  }

  private patchActiveRun(patch: Partial<RunState>): void {
    const turns = this.snapshot.turns
    if (turns.length === 0) return
    const index = turns.length - 1
    const current = turns[index]
    if (!current) return
    const nextTurns = turns.slice()
    nextTurns[index] = { ...current, run: { ...current.run, ...patch } }
    this.update({ turns: nextTurns })
  }

  private update(patch: Partial<CopilotEngineState>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private threadIsReadOnly(threadId: string): boolean {
    if (this.snapshot.threadId === threadId && this.snapshot.threadReadOnly) return true
    return this.snapshot.threads.some(
      (thread) => thread.id === threadId && thread.readOnly === true,
    )
  }

  private async requestCancellation(turnId: string, threadToken: number): Promise<void> {
    try {
      await this.options.transport.cancelTurn(turnId)
    } catch (error) {
      this.options.logger?.warn('netix-copilot: cancel request failed', error)
      const run = this.activeRun
      if (
        threadToken === this.threadSeq &&
        run?.turnId === turnId &&
        isRunActive(run) &&
        run.cancellation?.status === 'requested'
      ) {
        this.patchActiveRun({
          cancellation: {
            status: 'failed',
            message: `Cancellation request failed: ${describeError(error)} The run is still active.`,
          },
        })
      }
    }
  }

  private startSlowTimer(turnId: string, threadToken: number): void {
    this.clearSlowTimer()
    const threshold = this.options.slowRunThresholdMs ?? DEFAULT_SLOW_RUN_THRESHOLD_MS
    if (threshold <= 0) return
    this.activeSlowHandle = this.schedule(() => {
      this.activeSlowHandle = undefined
      const run = this.activeRun
      const threadId = this.snapshot.threadId
      if (
        threadToken !== this.threadSeq ||
        threadId === undefined ||
        run?.turnId !== turnId ||
        !isRunActive(run) ||
        run.cancellation?.status === 'requested' ||
        !this.liveTurnIds.has(turnId)
      ) {
        return
      }
      this.emitLifecycle({
        type: 'run_slow',
        threadId,
        turnId,
        ...(run.modelTier === undefined ? {} : { modelTier: run.modelTier }),
        elapsedMs: threshold,
        ...(this.snapshot.transport === undefined ? {} : { transport: this.snapshot.transport }),
      })
    }, threshold)
  }

  private clearSlowTimer(): void {
    if (this.activeSlowHandle === undefined) return
    this.unschedule(this.activeSlowHandle)
    this.activeSlowHandle = undefined
  }

  private stopTrackingActiveRun(): void {
    const turnId = this.activeRun?.turnId
    if (turnId !== undefined) this.liveTurnIds.delete(turnId)
    this.clearSlowTimer()
  }

  private reportTerminalLifecycle(previous: RunState, next: RunState): void {
    const turnId = next.turnId
    if (
      turnId === undefined ||
      !this.liveTurnIds.has(turnId) ||
      previous.status === next.status ||
      (next.status !== 'done' && next.status !== 'error' && next.status !== 'cancelled')
    ) {
      return
    }
    this.liveTurnIds.delete(turnId)
    this.clearSlowTimer()
    this.activeRestoredState = undefined
    const threadId = this.snapshot.threadId
    if (threadId === undefined || next.status === 'cancelled') return
    const durationMs =
      next.executionMs ??
      (next.startedAt === undefined ? undefined : Math.max(0, this.now() - next.startedAt))
    if (next.status === 'done') {
      this.emitLifecycle({
        type: 'run_completed',
        threadId,
        turnId,
        ...(next.modelTier === undefined ? {} : { modelTier: next.modelTier }),
        ...(durationMs === undefined ? {} : { durationMs }),
        ...(this.snapshot.transport === undefined ? {} : { transport: this.snapshot.transport }),
      })
      return
    }
    this.emitLifecycle({
      type: 'run_failed',
      threadId,
      turnId,
      ...(next.modelTier === undefined ? {} : { modelTier: next.modelTier }),
      ...(durationMs === undefined ? {} : { durationMs }),
      ...(this.snapshot.transport === undefined ? {} : { transport: this.snapshot.transport }),
      ...(next.error?.code === undefined ? {} : { code: next.error.code }),
      ...(next.error?.cause === undefined ? {} : { cause: next.error.cause }),
    })
  }

  private emitLifecycle(event: CopilotLifecycleEvent): void {
    try {
      this.options.onLifecycleEvent?.(event)
    } catch (error) {
      this.options.logger?.warn('netix-copilot: lifecycle callback failed', error)
    }
  }
}

function resumeCursor(error: unknown): string | undefined {
  return error instanceof StreamInterruptedError ? error.lastEventId : undefined
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'The copilot request failed.'
}
