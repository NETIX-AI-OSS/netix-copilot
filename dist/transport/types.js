"use strict";
// The transport contract, over two wire protocols that both speak the copilot event vocabulary in ../types.
// 'sse' is POST /api/copilot-turn/ then GET /api/copilot/turn/{id}/events, the streaming copilot contract.
// 'agentic' is POST /api/agentic-ml-request/ then polling its detail route, the contract the older chat surfaces call.
// 'auto' tries the streaming create once and remembers the answer, corroborating a missing-route
// reply against the contract itself before it settles on the poll contract.
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamInterruptedError = exports.NotStreamableError = void 0;
exports.isTerminalEvent = isTerminalEvent;
exports.fillTemplate = fillTemplate;
exports.newIdempotencyKey = newIdempotencyKey;
exports.sleep = sleep;
const TERMINAL_EVENTS = new Set(['done', 'error', 'cancelled']);
function isTerminalEvent(enveloped) {
    return TERMINAL_EVENTS.has(enveloped.event.type);
}
// Thrown when the stream endpoint exists but did not answer with an SSE body.
class NotStreamableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotStreamableError';
    }
}
exports.NotStreamableError = NotStreamableError;
// Thrown when the socket closed before a terminal event, carrying the resume cursor.
class StreamInterruptedError extends Error {
    constructor(lastEventId) {
        super('The copilot stream closed before the run finished.');
        this.name = 'StreamInterruptedError';
        this.lastEventId = lastEventId;
    }
}
exports.StreamInterruptedError = StreamInterruptedError;
function fillTemplate(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
}
// One key per user send, so a retry of that send replays on ml-engine instead of spending again.
function newIdempotencyKey() {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid !== undefined)
        return `nxcp-${uuid}`;
    return `nxcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function sleep(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }
        const onAbort = () => {
            clearTimeout(timer);
            resolve();
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
