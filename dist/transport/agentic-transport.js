"use strict";
// The transport for ml-engine's asynchronous request resource, the contract every existing chat surface calls.
// POST /api/agentic-ml-request/ opens a run, GET /api/agentic-ml-request/{id}/ is polled, /reply/ continues it.
// Successive snapshots are diffed into the same event vocabulary the stream emits, so nothing above this layer changes.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticTransport = exports.DEFAULT_AGENTIC_ENDPOINTS = exports.AGENTIC_STATUS = exports.encodeCursor = exports.decodeCursor = void 0;
const http_1 = require("./http");
const run_diff_1 = require("./run-diff");
const transcript_1 = require("./transcript");
const types_1 = require("./types");
var run_diff_2 = require("./run-diff");
Object.defineProperty(exports, "decodeCursor", { enumerable: true, get: function () { return run_diff_2.decodeCursor; } });
Object.defineProperty(exports, "encodeCursor", { enumerable: true, get: function () { return run_diff_2.encodeCursor; } });
var transcript_2 = require("./transcript");
Object.defineProperty(exports, "AGENTIC_STATUS", { enumerable: true, get: function () { return transcript_2.AGENTIC_STATUS; } });
exports.DEFAULT_AGENTIC_ENDPOINTS = {
    collection: '/api/agentic-ml-request/',
    detail: '/api/agentic-ml-request/{turnId}/',
    reply: '/api/agentic-ml-request/{turnId}/reply/',
};
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
class AgenticTransport {
    constructor(config) {
        this.name = 'agentic';
        this.config = config;
        this.endpoints = { ...exports.DEFAULT_AGENTIC_ENDPOINTS, ...config.endpoints };
        this.sleepImpl = config.sleepImpl ?? types_1.sleep;
    }
    async createTurn(input, signal) {
        // In this contract a thread and a turn are the same row: follow-ups POST to /reply/.
        if (input.threadId !== undefined && input.threadId !== '') {
            await (0, http_1.request)(this.config, (0, types_1.fillTemplate)(this.endpoints.reply, { turnId: input.threadId }), {
                method: 'POST',
                body: { message: input.prompt },
                ...(signal ? { signal } : {}),
            });
            return { turnId: input.threadId, threadId: input.threadId };
        }
        const identity = this.config.getIdentity?.();
        const scope = input.scope ?? {};
        const organizationId = identity?.organizationId ?? readNumber(scope, 'organization_id');
        const userId = identity?.userId ?? readNumber(scope, 'user_id');
        if (organizationId === undefined || userId === undefined) {
            throw new Error('netix-copilot: the agentic transport needs organizationId and userId. Supply them from ' +
                'the host page context or via getIdentity.');
        }
        const body = {
            organization_id: organizationId,
            user_id: userId,
            prompt_text: input.prompt,
        };
        if (this.config.maxTokens !== undefined)
            body.max_tokens = this.config.maxTokens;
        const payload = await (0, http_1.requestJson)(this.config, this.endpoints.collection, {
            method: 'POST',
            body,
            // Idempotency-Key makes a retried create replay rather than start a second run.
            headers: { 'Idempotency-Key': input.idempotencyKey ?? (0, types_1.newIdempotencyKey)() },
            ...(signal ? { signal } : {}),
        });
        const turnId = payload.id === undefined ? undefined : String(payload.id);
        if (turnId === undefined)
            throw new Error('ml-engine create returned no request id.');
        return { turnId, threadId: turnId };
    }
    // The live contract has no cancel route. Aborting the local reader is all the client can do,
    // and the run finishes server-side regardless.
    async cancelTurn() {
        return Promise.resolve();
    }
    // The poll resource surfaces no awaiting_approval step and serves no decision route, so there
    // is nothing to record against. Failing loudly is deliberate: resolving quietly would tell the
    // user a destructive action was authorised when nothing recorded it.
    async respondToApproval(turnId, stepId, approved) {
        throw new Error('netix-copilot: approvals need the streaming copilot contract. The agentic poll contract ' +
            `cannot record ${approved ? 'approval' : 'rejection'} of step ${stepId} on turn ${turnId}.`);
    }
    // The thread and the turn are the same row here, so a transcript is one GET of the request
    // resource, rebuilt into the turns the message view already knows how to render.
    async fetchThread(threadId, signal) {
        const path = (0, types_1.fillTemplate)(this.endpoints.detail, { turnId: encodeURIComponent(threadId) });
        const snapshot = await (0, http_1.requestJson)(this.config, path, {
            ...(signal ? { signal } : {}),
        });
        return (0, transcript_1.transcriptFromRequest)(snapshot, threadId);
    }
    async listThreads(signal) {
        const payload = await (0, http_1.requestJson)(this.config, this.endpoints.collection, {
            ...(signal ? { signal } : {}),
        });
        const rows = Array.isArray(payload)
            ? payload
            : isRecord(payload) && Array.isArray(payload.results)
                ? payload.results
                : [];
        return rows.filter(isRecord).map((row) => {
            const id = row.id === undefined ? '' : String(row.id);
            const prompt = typeof row.prompt_text === 'string' ? row.prompt_text : '';
            const updatedRaw = typeof row.updated_on === 'string' ? row.updated_on : undefined;
            const parsed = updatedRaw === undefined ? Number.NaN : Date.parse(updatedRaw);
            return {
                id,
                title: prompt === '' ? `Request ${id}` : truncate(prompt, 60),
                updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
            };
        });
    }
    async consumeRun(options) {
        options.onTransportChange?.('agentic');
        const path = (0, types_1.fillTemplate)(this.endpoints.detail, { turnId: options.turnId });
        const base = this.config.pollIntervalMs ?? 2000;
        const ceiling = this.config.maxPollIntervalMs ?? 10000;
        const cursor = (0, run_diff_1.decodeCursor)(options.lastEventId);
        let idleRounds = 0;
        while (!options.signal.aborted) {
            const snapshot = await (0, http_1.requestJson)(this.config, path, {
                signal: options.signal,
            });
            const events = (0, run_diff_1.diffRunSnapshot)(snapshot, cursor, options.turnId);
            for (const enveloped of events)
                options.onEvent(enveloped);
            if ((0, run_diff_1.isTerminalStatus)(snapshot.status))
                return;
            idleRounds = events.length === 0 ? Math.min(idleRounds + 1, 3) : 0;
            await this.sleepImpl(Math.min(base * 2 ** idleRounds, ceiling), options.signal);
        }
    }
}
exports.AgenticTransport = AgenticTransport;
function readNumber(scope, key) {
    const value = scope[key];
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        return Number(value);
    }
    return undefined;
}
function truncate(value, max) {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
