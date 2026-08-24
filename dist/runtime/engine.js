"use strict";
// The copilot engine: an external store that owns every network connection.
//
// Three hard rules are enforced here rather than in the components.
//
// 1. An idle dock holds no open connection. A stream is opened by send() and by nothing else.
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
class CopilotEngine {
    constructor(options) {
        this.listeners = new Set();
        this.refCount = 0;
        this.disposed = false;
        this.localTurnSeq = 0;
        this.threadSeq = 0;
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
            modelTier: 'base',
            modelTierLocked: false,
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
            if (this.refCount === 0)
                this.abortActiveRun();
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
        if (trimmed === '' || this.snapshot.sending || this.isStreaming)
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
        let created;
        try {
            created = await this.options.transport.createTurn(input);
        }
        catch (error) {
            this.update({ sending: false, modelTierLocked: this.snapshot.threadId !== undefined });
            this.pushEvent({
                type: 'error',
                error: { message: describeError(error), retryable: true },
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
        this.activeStreamUrl = created.streamUrl;
        this.activePollUrl = created.pollUrl;
        void this.consume(created.turnId, undefined, created.streamUrl, created.pollUrl);
    }
    cancel() {
        const run = this.activeRun;
        if (!run || !(0, run_store_1.isRunActive)(run))
            return;
        const turnId = run.turnId;
        this.abortActiveRun();
        this.pushEvent({ type: 'cancelled' });
        if (turnId !== undefined) {
            void this.options.transport.cancelTurn(turnId).catch((error) => {
                this.options.logger?.warn('netix-copilot: cancel request failed', error);
            });
        }
    }
    async approve(stepId, approved) {
        const turnId = this.activeRun?.turnId;
        if (turnId === undefined)
            return;
        await this.options.transport.respondToApproval(turnId, stepId, approved);
    }
    startNewThread() {
        this.abortActiveRun();
        this.forgetRunUrls();
        // Bumped so a transcript fetch still in flight cannot land on the empty new thread.
        this.threadSeq += 1;
        this.update({
            turns: [],
            sending: false,
            threadLoading: false,
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
        });
        if (fetchThread === undefined)
            return;
        try {
            const turns = await fetchThread.call(this.options.transport, threadId);
            // A later selection, or a send that already started a new turn, owns the panel now.
            if (token !== this.threadSeq || this.snapshot.turns.length > 0)
                return;
            const restoredTier = turns.find((turn) => turn.run.modelTier)?.run.modelTier ?? 'base';
            this.update({ turns, threadLoading: false, modelTier: restoredTier, modelTierLocked: true });
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
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.teardownHandle !== undefined) {
            this.unschedule(this.teardownHandle);
            this.teardownHandle = undefined;
        }
        this.abortActiveRun();
        this.unsubscribeOnline?.();
        this.unsubscribeOnline = undefined;
        this.listeners.clear();
    }
    // Read the whole run to completion, resuming from the last seen event if the socket drops.
    async consume(turnId, lastEventId, streamUrl, pollUrl) {
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
                    onEvent: (enveloped) => this.pushEnveloped(enveloped),
                    ...(cursor === undefined ? {} : { lastEventId: cursor }),
                    ...(streamUrl === undefined ? {} : { streamUrl }),
                    ...(pollUrl === undefined ? {} : { pollUrl }),
                    onTransportChange: (name) => {
                        if (this.snapshot.transport !== name)
                            this.update({ transport: name });
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
            void this.consume(run.turnId, run.lastEventId, this.activeStreamUrl, this.activePollUrl);
        }
    }
    abortActiveRun() {
        this.controller?.abort();
        this.controller = undefined;
    }
    forgetRunUrls() {
        this.activeStreamUrl = undefined;
        this.activePollUrl = undefined;
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
        const nextRun = (0, run_store_1.applyEnveloped)(current.run, enveloped);
        if (nextRun === current.run)
            return;
        const nextTurns = turns.slice();
        nextTurns[index] = { ...current, run: nextRun };
        this.update({ turns: nextTurns });
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
