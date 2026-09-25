"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotEngine = void 0;
exports.browserOnlineSource = browserOnlineSource;
const types_1 = require("../transport/types");
const run_store_1 = require("./run-store");
function browserOnlineSource() {
    return {
        isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
        subscribe: (listener) => {
            if (typeof window === 'undefined')
                return () => undefined;
            const onOnline = () => listener(true);
            const onOffline = () => listener(false);
            window.addEventListener('online', onOnline);
            window.addEventListener('offline', onOffline);
            return () => {
                window.removeEventListener('online', onOnline);
                window.removeEventListener('offline', onOffline);
            };
        },
    };
}
const DEFAULT_TEARDOWN_GRACE_MS = 250;
const DEFAULT_MAX_RESUME_ATTEMPTS = 3;
const DEFAULT_RESUME_DELAY_MS = 750;
const DEFAULT_SLOW_RUN_THRESHOLD_MS = 10000;
class CopilotEngine {
    constructor(options) {
        this.listeners = new Set();
        this.refCount = 0;
        this.disposed = false;
        this.localTurnSeq = 0;
        this.threadSeq = 0;
        this.liveTurnIds = new Set();
        this.cancelAfterCreate = new Set();
        this.dockMode = 'min';
        this.subscribe = (listener) => {
            this.listeners.add(listener);
            return () => {
                this.listeners.delete(listener);
            };
        };
        this.getSnapshot = () => this.snapshot;
        this.options = options;
        this.now = options.now ?? (() => Date.now());
        this.schedule = options.setTimeoutImpl ?? ((handler, ms) => setTimeout(handler, ms));
        this.unschedule = options.clearTimeoutImpl ?? ((handle) => clearTimeout(handle));
        const onlineSource = options.onlineSource ?? browserOnlineSource();
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
        };
        this.unsubscribeOnline = onlineSource.subscribe((online) => this.handleConnectivity(online));
    }
    // Mounting a surface retains the engine; the last release stops any work after a grace period.
    retain() {
        this.refCount += 1;
        if (this.teardownHandle !== undefined) {
            this.unschedule(this.teardownHandle);
            this.teardownHandle = undefined;
        }
    }
    release() {
        this.refCount = Math.max(0, this.refCount - 1);
        if (this.refCount > 0 || this.teardownHandle !== undefined)
            return;
        const grace = this.options.teardownGraceMs ?? DEFAULT_TEARDOWN_GRACE_MS;
        this.teardownHandle = this.schedule(() => {
            this.teardownHandle = undefined;
            if (this.refCount === 0) {
                this.stopTrackingActiveRun();
                this.abortActiveRun();
            }
        }, grace);
    }
    get activeRun() {
        const last = this.snapshot.turns[this.snapshot.turns.length - 1];
        return last?.run;
    }
    get isStreaming() {
        const run = this.activeRun;
        return run !== undefined && (0, run_store_1.isRunActive)(run);
    }
    // `prompt` is what the transcript shows. `options.wireText` is what the backend receives when
    // the host had to append something the user must not see -- a scope hint, for instance, which
    // the agentic contract has no field for.
    async send(prompt, scope, options) {
        const trimmed = prompt.trim();
        if (trimmed === '' || this.snapshot.threadReadOnly || this.snapshot.sending || this.isStreaming)
            return;
        const wireText = options?.wireText?.trim();
        const wire = wireText === undefined || wireText === '' ? trimmed : wireText;
        this.localTurnSeq += 1;
        const turn = {
            id: `local-${this.localTurnSeq}`,
            prompt: trimmed,
            createdAt: this.now(),
            run: { ...(0, run_store_1.initialRunState)(), status: 'creating' },
            ...(wire === trimmed ? {} : { wirePrompt: wire }),
        };
        this.update({ turns: [...this.snapshot.turns, turn], sending: true });
        this.emitLifecycle({
            type: 'message_sent',
            ...(this.snapshot.threadId === undefined ? {} : { threadId: this.snapshot.threadId }),
            modelTier: this.snapshot.modelTier,
            surface: this.options.conversationSurface ?? 'web',
            contextIncluded: options?.contextIncluded ?? scope !== undefined,
        });
        // Minted once per user send, so any retry of this send replays server-side instead of spending again.
        const input = {
            prompt: wire,
            idempotencyKey: (0, types_1.newIdempotencyKey)(),
            modelTier: this.snapshot.modelTier,
            surface: this.options.conversationSurface ?? 'web',
        };
        if (this.snapshot.threadId !== undefined)
            input.threadId = this.snapshot.threadId;
        if (scope !== undefined)
            input.scope = scope;
        // A thread opened while the create is in flight owns the panel; this turn is not on it.
        const token = this.threadSeq;
        let created;
        try {
            created = await this.options.transport.createTurn(input);
        }
        catch (error) {
            this.cancelAfterCreate.delete(token);
            if (token !== this.threadSeq)
                return;
            this.update({ sending: false, modelTierLocked: this.snapshot.threadId !== undefined });
            this.pushEvent({
                type: 'error',
                error: { message: describeError(error), retryable: true },
            });
            this.emitLifecycle({
                type: 'run_failed',
                ...(this.snapshot.threadId === undefined ? {} : { threadId: this.snapshot.threadId }),
                modelTier: this.snapshot.modelTier,
            });
            return;
        }
        const cancellationRequested = this.cancelAfterCreate.delete(token);
        if (token !== this.threadSeq) {
            if (cancellationRequested) {
                void this.options.transport.cancelTurn(created.turnId).catch((error) => {
                    this.options.logger?.warn('netix-copilot: late-created turn cancellation failed', error);
                });
            }
            this.options.logger?.warn('netix-copilot: turn created after the thread changed; dropped', {
                turnId: created.turnId,
            });
            return;
        }
        this.update({
            sending: false,
            threadId: created.threadId ?? this.snapshot.threadId ?? created.turnId,
            modelTier: created.modelTier ?? this.snapshot.modelTier,
            modelTierLocked: true,
        });
        this.patchActiveRun({ turnId: created.turnId });
        this.liveTurnIds.add(created.turnId);
        this.activeStreamUrl = created.streamUrl;
        this.activePollUrl = created.pollUrl;
        this.activeRestoredState = undefined;
        this.startSlowTimer(created.turnId, token);
        void this.consume(created.turnId, undefined, created.streamUrl, created.pollUrl, token);
        if (cancellationRequested || this.activeRun?.cancellation?.status === 'requested') {
            void this.requestCancellation(created.turnId, token);
        }
    }
    cancel() {
        if (this.snapshot.threadReadOnly)
            return;
        const run = this.activeRun;
        if (!run || !(0, run_store_1.isRunActive)(run) || run.cancellation?.status === 'requested')
            return;
        this.patchActiveRun({ cancellation: { status: 'requested' } });
        if (run.turnId !== undefined)
            void this.requestCancellation(run.turnId, this.threadSeq);
        else
            this.cancelAfterCreate.add(this.threadSeq);
    }
    recordDockMode(mode) {
        const previous = this.dockMode;
        this.dockMode = mode;
        if (previous === 'min' && mode !== 'min')
            this.emitLifecycle({ type: 'dock_opened', mode });
    }
    async approve(stepId, approved) {
        if (this.snapshot.threadReadOnly)
            return;
        const turnId = this.activeRun?.turnId;
        if (turnId === undefined)
            return;
        await this.options.transport.respondToApproval(turnId, stepId, approved);
    }
    startNewThread() {
        this.stopTrackingActiveRun();
        this.abortActiveRun();
        this.forgetRunUrls();
        // Bumped so a transcript fetch still in flight cannot land on the empty new thread.
        this.threadSeq += 1;
        this.update({
            turns: [],
            sending: false,
            threadLoading: false,
            threadReadOnly: false,
            modelTier: 'base',
            modelTierLocked: false,
        });
        const next = { ...this.snapshot };
        delete next.threadId;
        this.snapshot = next;
        this.notify();
    }
    // Kept void-returning so a click handler stays a click handler. Await loadThread when the
    // transcript itself is what the caller is waiting on.
    selectThread(threadId) {
        void this.loadThread(threadId);
    }
    // Point the engine at a stored thread and rebuild its history, so a deep link or a sidebar
    // click restores the plan, the charts and the result tables rather than an empty panel.
    async loadThread(threadId) {
        // Re-selecting the open thread is a mis-click, not a reload: it must not drop a live run.
        if (threadId === this.snapshot.threadId && this.snapshot.turns.length > 0)
            return;
        this.stopTrackingActiveRun();
        this.abortActiveRun();
        this.forgetRunUrls();
        this.threadSeq += 1;
        const token = this.threadSeq;
        const fetchThread = this.options.transport.fetchThread;
        this.update({
            threadId,
            turns: [],
            sending: false,
            threadLoading: fetchThread !== undefined,
            threadReadOnly: false,
        });
        if (fetchThread === undefined)
            return;
        try {
            const accessRequest = this.options.transport.fetchThreadAccess?.call(this.options.transport, threadId);
            const [turns, access] = await Promise.all([
                fetchThread.call(this.options.transport, threadId),
                accessRequest ?? Promise.resolve({ readOnly: false }),
            ]);
            // A later selection, or a send that already started a new turn, owns the panel now.
            if (token !== this.threadSeq || this.snapshot.turns.length > 0)
                return;
            const restoredTier = turns.find((turn) => turn.run.modelTier)?.run.modelTier ?? 'base';
            this.update({
                turns,
                threadLoading: false,
                threadReadOnly: access.readOnly,
                modelTier: restoredTier,
                modelTierLocked: true,
            });
            const restored = turns[turns.length - 1]?.run;
            if (restored !== undefined && (0, run_store_1.isRunActive)(restored) && restored.turnId !== undefined) {
                this.activeRestoredState = restored;
                if (this.snapshot.online) {
                    void this.consume(restored.turnId, restored.lastEventId, undefined, undefined, token, restored);
                }
                else {
                    this.patchActiveRun({ status: 'paused', offline: true });
                }
            }
        }
        catch (error) {
            if (token !== this.threadSeq)
                return;
            this.options.logger?.warn('netix-copilot: thread transcript unavailable', error);
            this.update({ threadLoading: false });
        }
    }
    async loadThreads() {
        try {
            const threads = await this.options.transport.listThreads();
            this.update({ threads, threadsLoaded: true });
        }
        catch (error) {
            this.options.logger?.warn('netix-copilot: thread list unavailable', error);
            this.update({ threadsLoaded: true });
        }
    }
    setModelTier(tier) {
        if (this.snapshot.modelTierLocked || this.snapshot.sending || this.isStreaming)
            return;
        this.update({ modelTier: tier });
    }
    setContextEnabled(enabled) {
        if (this.snapshot.contextEnabled === enabled)
            return;
        this.update({ contextEnabled: enabled });
    }
    // Rename or pin a stored thread. The list updates first so the rail answers immediately, and
    // is put back if the backend refuses.
    async updateThread(threadId, patch) {
        if (this.threadIsReadOnly(threadId))
            return;
        const update = this.options.transport.updateThread;
        if (update === undefined)
            return;
        const previous = this.snapshot.threads;
        this.update({
            threads: previous.map((thread) => thread.id === threadId
                ? {
                    ...thread,
                    ...(patch.title === undefined ? {} : { title: patch.title }),
                    ...(patch.isPinned === undefined ? {} : { isPinned: patch.isPinned }),
                }
                : thread),
        });
        try {
            const saved = await update.call(this.options.transport, threadId, patch);
            this.update({
                threads: this.snapshot.threads.map((thread) => (thread.id === threadId ? saved : thread)),
            });
        }
        catch (error) {
            this.options.logger?.warn('netix-copilot: thread update failed', error);
            this.update({ threads: previous });
            throw error;
        }
    }
    // Delete a stored thread. Deleting the open one empties the panel, exactly like New.
    async deleteThread(threadId) {
        if (this.threadIsReadOnly(threadId))
            return;
        const remove = this.options.transport.deleteThread;
        if (remove === undefined)
            return;
        await remove.call(this.options.transport, threadId);
        if (this.snapshot.threadId === threadId)
            this.startNewThread();
        this.update({ threads: this.snapshot.threads.filter((thread) => thread.id !== threadId) });
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.teardownHandle !== undefined) {
            this.unschedule(this.teardownHandle);
            this.teardownHandle = undefined;
        }
        this.stopTrackingActiveRun();
        this.abortActiveRun();
        this.unsubscribeOnline?.();
        this.unsubscribeOnline = undefined;
        this.listeners.clear();
    }
    // Read the whole run to completion, resuming from the last seen event if the socket drops.
    async consume(turnId, lastEventId, streamUrl, pollUrl, threadToken = this.threadSeq, restoredState) {
        const controller = new AbortController();
        this.controller = controller;
        let cursor = lastEventId;
        let attempts = 0;
        const maxAttempts = this.options.maxResumeAttempts ?? DEFAULT_MAX_RESUME_ATTEMPTS;
        while (!controller.signal.aborted && !this.disposed) {
            try {
                await this.options.transport.consumeRun({
                    turnId,
                    signal: controller.signal,
                    onEvent: (enveloped) => {
                        if (threadToken === this.threadSeq &&
                            this.controller === controller &&
                            !controller.signal.aborted) {
                            this.pushEnveloped(enveloped);
                        }
                    },
                    ...(cursor === undefined ? {} : { lastEventId: cursor }),
                    ...(streamUrl === undefined ? {} : { streamUrl }),
                    ...(pollUrl === undefined ? {} : { pollUrl }),
                    ...(restoredState === undefined ? {} : { restoredState }),
                    onTransportChange: (name) => {
                        if (threadToken === this.threadSeq && this.snapshot.transport !== name) {
                            this.update({ transport: name });
                        }
                    },
                });
                break;
            }
            catch (error) {
                if (controller.signal.aborted || this.disposed)
                    return;
                cursor = resumeCursor(error) ?? this.activeRun?.lastEventId ?? cursor;
                if (!this.snapshot.online) {
                    // Offline is a pause, not a failure. handleConnectivity resumes from this cursor.
                    this.patchActiveRun({ status: 'paused', offline: true });
                    return;
                }
                attempts += 1;
                if (attempts > maxAttempts) {
                    this.pushEvent({
                        type: 'error',
                        error: { message: describeError(error), retryable: true },
                    });
                    return;
                }
                await this.delay((this.options.resumeDelayMs ?? DEFAULT_RESUME_DELAY_MS) * attempts);
            }
        }
        if (this.controller === controller)
            this.controller = undefined;
    }
    handleConnectivity(online) {
        if (this.snapshot.online === online)
            return;
        this.update({ online });
        const run = this.activeRun;
        if (!run)
            return;
        if (!online) {
            if ((0, run_store_1.isRunActive)(run)) {
                this.abortActiveRun();
                this.patchActiveRun({ status: 'paused', offline: true });
            }
            return;
        }
        if (run.status === 'paused' && run.turnId !== undefined) {
            this.patchActiveRun({ status: 'streaming', offline: false });
            void this.consume(run.turnId, run.lastEventId, this.activeStreamUrl, this.activePollUrl, this.threadSeq, this.activeRestoredState);
        }
    }
    abortActiveRun() {
        this.controller?.abort();
        this.controller = undefined;
    }
    forgetRunUrls() {
        this.activeStreamUrl = undefined;
        this.activePollUrl = undefined;
        this.activeRestoredState = undefined;
    }
    delay(ms) {
        return new Promise((resolve) => {
            this.schedule(() => resolve(), ms);
        });
    }
    pushEnveloped(enveloped) {
        const turns = this.snapshot.turns;
        if (turns.length === 0)
            return;
        const index = turns.length - 1;
        const current = turns[index];
        if (!current)
            return;
        // An older backend stamps no start time on run_started; the elapsed counter still needs one.
        const event = enveloped.event;
        const stamped = event.type === 'run_started' && event.startedAt === undefined
            ? { ...enveloped, event: { ...event, startedAt: this.now() } }
            : enveloped;
        const nextRun = (0, run_store_1.applyEnveloped)(current.run, stamped);
        if (nextRun === current.run)
            return;
        const nextTurns = turns.slice();
        nextTurns[index] = { ...current, run: nextRun };
        this.update({ turns: nextTurns });
        this.reportTerminalLifecycle(current.run, nextRun);
    }
    pushEvent(event) {
        this.pushEnveloped({ event });
    }
    patchActiveRun(patch) {
        const turns = this.snapshot.turns;
        if (turns.length === 0)
            return;
        const index = turns.length - 1;
        const current = turns[index];
        if (!current)
            return;
        const nextTurns = turns.slice();
        nextTurns[index] = { ...current, run: { ...current.run, ...patch } };
        this.update({ turns: nextTurns });
    }
    update(patch) {
        this.snapshot = { ...this.snapshot, ...patch };
        this.notify();
    }
    notify() {
        for (const listener of this.listeners)
            listener();
    }
    threadIsReadOnly(threadId) {
        if (this.snapshot.threadId === threadId && this.snapshot.threadReadOnly)
            return true;
        return this.snapshot.threads.some((thread) => thread.id === threadId && thread.readOnly === true);
    }
    async requestCancellation(turnId, threadToken) {
        try {
            await this.options.transport.cancelTurn(turnId);
        }
        catch (error) {
            this.options.logger?.warn('netix-copilot: cancel request failed', error);
            const run = this.activeRun;
            if (threadToken === this.threadSeq &&
                run?.turnId === turnId &&
                (0, run_store_1.isRunActive)(run) &&
                run.cancellation?.status === 'requested') {
                this.patchActiveRun({
                    cancellation: {
                        status: 'failed',
                        message: `Cancellation request failed: ${describeError(error)} The run is still active.`,
                    },
                });
            }
        }
    }
    startSlowTimer(turnId, threadToken) {
        this.clearSlowTimer();
        const threshold = this.options.slowRunThresholdMs ?? DEFAULT_SLOW_RUN_THRESHOLD_MS;
        if (threshold <= 0)
            return;
        this.activeSlowHandle = this.schedule(() => {
            this.activeSlowHandle = undefined;
            const run = this.activeRun;
            const threadId = this.snapshot.threadId;
            if (threadToken !== this.threadSeq ||
                threadId === undefined ||
                run?.turnId !== turnId ||
                !(0, run_store_1.isRunActive)(run) ||
                run.cancellation?.status === 'requested' ||
                !this.liveTurnIds.has(turnId)) {
                return;
            }
            this.emitLifecycle({
                type: 'run_slow',
                threadId,
                turnId,
                ...(run.modelTier === undefined ? {} : { modelTier: run.modelTier }),
                elapsedMs: threshold,
                ...(this.snapshot.transport === undefined ? {} : { transport: this.snapshot.transport }),
            });
        }, threshold);
    }
    clearSlowTimer() {
        if (this.activeSlowHandle === undefined)
            return;
        this.unschedule(this.activeSlowHandle);
        this.activeSlowHandle = undefined;
    }
    stopTrackingActiveRun() {
        const turnId = this.activeRun?.turnId;
        if (turnId !== undefined)
            this.liveTurnIds.delete(turnId);
        this.clearSlowTimer();
    }
    reportTerminalLifecycle(previous, next) {
        const turnId = next.turnId;
        if (turnId === undefined ||
            !this.liveTurnIds.has(turnId) ||
            previous.status === next.status ||
            (next.status !== 'done' && next.status !== 'error' && next.status !== 'cancelled')) {
            return;
        }
        this.liveTurnIds.delete(turnId);
        this.clearSlowTimer();
        this.activeRestoredState = undefined;
        const threadId = this.snapshot.threadId;
        // A conversation started here is missing from a list loaded earlier, so the rail would not
        // show it (or mark it current) until a reload. Refetch once when its first run settles.
        if (threadId !== undefined &&
            this.snapshot.threadsLoaded &&
            !this.snapshot.threads.some((thread) => thread.id === threadId)) {
            void this.loadThreads();
        }
        if (threadId === undefined || next.status === 'cancelled')
            return;
        const durationMs = next.executionMs ??
            (next.startedAt === undefined ? undefined : Math.max(0, this.now() - next.startedAt));
        if (next.status === 'done') {
            this.emitLifecycle({
                type: 'run_completed',
                threadId,
                turnId,
                ...(next.modelTier === undefined ? {} : { modelTier: next.modelTier }),
                ...(durationMs === undefined ? {} : { durationMs }),
                ...(this.snapshot.transport === undefined ? {} : { transport: this.snapshot.transport }),
            });
            return;
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
        });
    }
    emitLifecycle(event) {
        try {
            this.options.onLifecycleEvent?.(event);
        }
        catch (error) {
            this.options.logger?.warn('netix-copilot: lifecycle callback failed', error);
        }
    }
}
exports.CopilotEngine = CopilotEngine;
function resumeCursor(error) {
    return error instanceof types_1.StreamInterruptedError ? error.lastEventId : undefined;
}
function describeError(error) {
    if (error instanceof Error)
        return error.message;
    return 'The copilot request failed.';
}
