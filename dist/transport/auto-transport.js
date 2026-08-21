"use strict";
// Picks a transport once and remembers the answer.
//
// The copilot rollout is not atomic: the streaming routes land on ml-engine at some point after
// the host apps ship this SDK. `auto` probes the streaming create endpoint on the first turn and
// permanently falls back to the agentic poll contract when it is not there, so a given tab makes
// exactly one wasted request in the worst case rather than one per turn.
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
            if (!isRouteMissing(error))
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
            if (!isRouteMissing(error))
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
    listThreads(signal) {
        return (this.resolved ?? this.polling).listThreads(signal);
    }
    // History reads through whichever transport is live, defaulting to polling for the same reason
    // listThreads does: before the first send the poll contract is the one known to be deployed.
    async fetchThread(threadId, signal) {
        const target = this.resolved ?? this.polling;
        return target.fetchThread ? target.fetchThread(threadId, signal) : [];
    }
}
exports.AutoTransport = AutoTransport;
function isRouteMissing(error) {
    return error instanceof http_1.CopilotHttpError && error.isRouteMissing;
}
