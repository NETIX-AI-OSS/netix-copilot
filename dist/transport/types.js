"use strict";
// The transport contract.
//
// Everything above this line speaks one language: the copilot event vocabulary in ../types.
// Below it there are two very different wire protocols, and which one is live matters:
//
//   'sse'     -- POST /turns/ then GET /turns/{id}/stream, the streaming contract from the
//                copilot blueprint. Verified 2026-08-21: ml-engine does NOT serve this yet.
//   'agentic' -- POST /api/agentic-ml-request/ then poll GET /api/agentic-ml-request/{id}/.
//                This is what ml-engine actually serves today and what every existing chat
//                surface in the fleet already calls. It synthesizes the same event vocabulary
//                from successive snapshots, so the UI layer cannot tell the two apart.
//
// 'auto' probes the streaming route once and remembers the answer.
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamInterruptedError = exports.NotStreamableError = void 0;
exports.isTerminalEvent = isTerminalEvent;
exports.fillTemplate = fillTemplate;
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
