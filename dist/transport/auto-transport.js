"use strict";
// Picks a transport once and remembers the answer.
// The streaming create is the live contract, so it is what everything defaults to before the first send.
// A create that 404s means a deployment without those routes; that tab then stays on the agentic poll contract.
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
    // Threads are conversations, and a conversation id is what a briefing deep link carries, so the
    // list and the transcript both read through streaming until a failed create says otherwise.
    listThreads(signal) {
        return (this.resolved ?? this.streaming).listThreads(signal);
    }
    async fetchThread(threadId, signal) {
        const target = this.resolved ?? this.streaming;
        return target.fetchThread ? target.fetchThread(threadId, signal) : [];
    }
}
exports.AutoTransport = AutoTransport;
function isRouteMissing(error) {
    return error instanceof http_1.CopilotHttpError && error.isRouteMissing;
}
