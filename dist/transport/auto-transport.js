"use strict";
// Picks a transport once and remembers the answer.
// The streaming create is the live contract, so it is what everything defaults to before the first send.
// A create that reports a missing route means a deployment without those routes; that tab then stays
// on the agentic poll contract. Because that decision lasts the life of the tab, it is never taken on
// the strength of one request: the streaming contract is asked directly before streaming is given up.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoTransport = void 0;
const http_1 = require("./http");
class AutoTransport {
    constructor(streaming, polling) {
        this.streaming = streaming;
        this.polling = polling;
    }
    get name() {
        return this.resolved?.name ?? this.streaming.name;
    }
    // The transport that has actually been chosen, or undefined before the first turn.
    get selected() {
        return this.resolved?.name;
    }
    async createTurn(input, signal) {
        if (this.resolved)
            return this.resolved.createTurn(input, signal);
        try {
            const created = await this.streaming.createTurn(input, signal);
            this.resolved = this.streaming;
            return created;
        }
        catch (error) {
            if (!(await this.streamingIsAbsent(error, signal)))
                throw error;
            this.resolved = this.polling;
            return this.polling.createTurn(input, signal);
        }
    }
    async consumeRun(options) {
        if (this.resolved)
            return this.resolved.consumeRun(options);
        try {
            await this.streaming.consumeRun(options);
            this.resolved = this.streaming;
        }
        catch (error) {
            if (!(await this.streamingIsAbsent(error, options.signal)))
                throw error;
            this.resolved = this.polling;
            await this.polling.consumeRun(options);
        }
    }
    cancelTurn(turnId) {
        return (this.resolved ?? this.polling).cancelTurn(turnId);
    }
    respondToApproval(turnId, stepId, approved) {
        return (this.resolved ?? this.streaming).respondToApproval(turnId, stepId, approved);
    }
    // Threads are conversations, and a conversation id is what a briefing deep link carries, so the
    // list and the transcript both read through streaming until a failed create says otherwise.
    // A missing route answers empty rather than throwing: this dock is mounted on every
    // authenticated route, and a cluster whose ml-engine has no thread store genuinely has no
    // threads. It must not degrade to polling, which cannot resolve a conversation id at all.
    async listThreads(signal) {
        try {
            return await (this.resolved ?? this.streaming).listThreads(signal);
        }
        catch (error) {
            if ((0, http_1.isRouteMissing)(error))
                return [];
            throw error;
        }
    }
    async fetchThread(threadId, signal) {
        const target = this.resolved ?? this.streaming;
        if (!target.fetchThread)
            return [];
        try {
            return await target.fetchThread(threadId, signal);
        }
        catch (error) {
            if ((0, http_1.isRouteMissing)(error))
                return [];
            throw error;
        }
    }
    // Thread housekeeping only the copilot contract serves. A transport without it throws the same
    // missing-route error the route itself would, so the engine reverts its optimistic list edit.
    updateThread(threadId, patch, signal) {
        const target = this.resolved ?? this.streaming;
        if (!target.updateThread)
            return Promise.reject(notServed('update'));
        return target.updateThread(threadId, patch, signal);
    }
    deleteThread(threadId, signal) {
        const target = this.resolved ?? this.streaming;
        if (!target.deleteThread)
            return Promise.reject(notServed('delete'));
        return target.deleteThread(threadId, signal);
    }
    // One request's failure is never proof that a contract is absent. ml-engine 404s a create that
    // names a thread the caller does not own, and reading that as "streaming is not deployed" pinned
    // the tab to polling for good over a stale bookmark. So a missing-route answer is corroborated
    // against the streaming contract itself, and only a transport that cannot be asked is believed.
    async streamingIsAbsent(error, signal) {
        if (!(0, http_1.isRouteMissing)(error))
            return false;
        const probe = this.streaming.isDeployed;
        if (probe === undefined)
            return true;
        try {
            return !(await probe.call(this.streaming, signal));
        }
        catch {
            return true;
        }
    }
}
exports.AutoTransport = AutoTransport;
function notServed(action) {
    return new http_1.CopilotHttpError(501, '', `netix-copilot: the selected transport cannot ${action} a conversation.`);
}
