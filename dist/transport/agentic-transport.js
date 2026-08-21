"use strict";
// The transport that works against production today.
//
// ml-engine exposes an asynchronous request resource, not a stream:
//   POST /api/agentic-ml-request/         -> 201 { id, status: 0 }
//   GET  /api/agentic-ml-request/{id}/    -> the whole run so far, polled
//   POST /api/agentic-ml-request/{id}/reply/ -> 202, no body, 409 unless COMPLETED or ERRORED
//
// This class polls that resource and diffs successive snapshots into the same event vocabulary
// the streaming contract will emit, so nothing above the transport layer changes when SSE lands.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticTransport = exports.DEFAULT_AGENTIC_ENDPOINTS = exports.AGENTIC_STATUS = void 0;
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
const http_1 = require("./http");
const types_1 = require("./types");
// service/models.py StatusChoices.
exports.AGENTIC_STATUS = {
    PENDING: 0,
    COMPLETED: 1,
    ERRORED: 2,
    PROCESSING: 3,
    CANCELLED: 4,
};
exports.DEFAULT_AGENTIC_ENDPOINTS = {
    collection: '/api/agentic-ml-request/',
    detail: '/api/agentic-ml-request/{turnId}/',
    reply: '/api/agentic-ml-request/{turnId}/reply/',
};
const CURSOR_PREFIX = 'agentic';
function encodeCursor(cursor) {
    const flags = (cursor.planEmitted ? 'p' : '-') +
        (cursor.chartEmitted ? 'c' : '-') +
        (cursor.runStarted ? 'r' : '-') +
        (cursor.queuedEmitted ? 'q' : '-');
    return [
        CURSOR_PREFIX,
        cursor.textLength,
        cursor.logCount,
        flags,
        encodeURIComponent(cursor.usageSignature),
    ].join(':');
}
function decodeCursor(raw) {
    const empty = {
        textLength: 0,
        logCount: 0,
        planEmitted: false,
        chartEmitted: false,
        usageSignature: '',
        runStarted: false,
        queuedEmitted: false,
    };
    if (raw === undefined)
        return empty;
    const parts = raw.split(':');
    if (parts[0] !== CURSOR_PREFIX || parts.length < 4)
        return empty;
    const textLength = Number(parts[1]);
    const logCount = Number(parts[2]);
    const flags = parts[3] ?? '';
    return {
        textLength: Number.isFinite(textLength) ? textLength : 0,
        logCount: Number.isFinite(logCount) ? logCount : 0,
        planEmitted: flags.includes('p'),
        chartEmitted: flags.includes('c'),
        runStarted: flags.includes('r'),
        queuedEmitted: flags.includes('q'),
        usageSignature: decodeURIComponent(parts[4] ?? ''),
    };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function commonPrefixLength(a, b) {
    const limit = Math.min(a.length, b.length);
    let index = 0;
    while (index < limit && a.charCodeAt(index) === b.charCodeAt(index))
        index += 1;
    return index;
}
// execution_log entries are { tool, call_id, iteration, arguments, output }, so the argument
// summary has to be built here rather than read off a field.
function summarizeArguments(value) {
    if (typeof value === 'string')
        return value;
    if (!isRecord(value))
        return undefined;
    const parts = [];
    for (const [key, entry] of Object.entries(value)) {
        if (entry === null || entry === undefined)
            continue;
        const rendered = typeof entry === 'object'
            ? Array.isArray(entry)
                ? `[${entry.length}]`
                : '{…}'
            : String(entry);
        parts.push(`${key}=${rendered}`);
        if (parts.length === 4)
            break;
    }
    if (parts.length === 0)
        return undefined;
    const summary = parts.join(', ');
    return summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
}
function usageSignature(usage) {
    if (!usage)
        return '';
    return JSON.stringify(usage);
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
            headers: { 'Idempotency-Key': buildIdempotencyKey(organizationId, userId, input.prompt) },
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
    async respondToApproval() {
        throw new Error('netix-copilot: approvals need the streaming copilot contract; ml-engine does not serve them yet.');
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
        const cursor = decodeCursor(options.lastEventId);
        let idleRounds = 0;
        while (!options.signal.aborted) {
            const snapshot = await (0, http_1.requestJson)(this.config, path, {
                signal: options.signal,
            });
            const events = this.diff(snapshot, cursor, options.turnId);
            for (const enveloped of events)
                options.onEvent(enveloped);
            if (isTerminalStatus(snapshot.status))
                return;
            idleRounds = events.length === 0 ? Math.min(idleRounds + 1, 3) : 0;
            await this.sleepImpl(Math.min(base * 2 ** idleRounds, ceiling), options.signal);
        }
    }
    // Turn one snapshot into the events it implies, advancing the cursor in place.
    diff(snapshot, cursor, turnId) {
        const events = [];
        const emit = (event) => {
            events.push({ event, id: encodeCursor(cursor) });
        };
        if (!cursor.runStarted) {
            cursor.runStarted = true;
            emit({ type: 'run_started', turnId });
        }
        if (snapshot.status === exports.AGENTIC_STATUS.PENDING && !cursor.queuedEmitted) {
            cursor.queuedEmitted = true;
            emit({ type: 'queued' });
        }
        const plan = Array.isArray(snapshot.plan) ? snapshot.plan : [];
        if (!cursor.planEmitted && plan.length > 0) {
            cursor.planEmitted = true;
            emit({
                type: 'plan',
                steps: plan.filter(isRecord).map((entry, index) => ({
                    id: readStepId(entry, index),
                    title: readStepTitle(entry, index),
                    status: entry.status === 'completed' ? 'ok' : 'pending',
                    ...(typeof entry.tool === 'string' ? { tool: entry.tool } : {}),
                    ...(typeof entry.detail === 'string' ? { detail: entry.detail } : {}),
                })),
            });
        }
        const log = Array.isArray(snapshot.execution_log) ? snapshot.execution_log : [];
        for (let index = cursor.logCount; index < log.length; index += 1) {
            const entry = log[index];
            if (!isRecord(entry))
                continue;
            const summary = summarizeArguments(entry.arguments);
            emitStepPair(emit, {
                id: readStepId(entry, index),
                title: readStepTitle(entry, index),
                ...(typeof entry.tool === 'string' ? { tool: entry.tool } : {}),
                ...(summary === undefined ? {} : { argsSummary: summary }),
            });
        }
        cursor.logCount = log.length;
        const text = typeof snapshot.response_text === 'string' ? snapshot.response_text : '';
        if (text.length > cursor.textLength) {
            // The snapshot carries the whole answer every time, so send only what is new. A rewritten
            // answer falls back to the common prefix, which is the closest an append-only feed allows.
            const seen = text.slice(0, cursor.textLength);
            const from = seen === text.slice(0, seen.length) ? cursor.textLength : commonPrefixLength(seen, text);
            cursor.textLength = text.length;
            emit({ type: 'message_delta', text: text.slice(from) });
        }
        if (!cursor.chartEmitted &&
            snapshot.chart_available === true &&
            isRecord(snapshot.chart_config)) {
            if (Object.keys(snapshot.chart_config).length > 0) {
                cursor.chartEmitted = true;
                emit({ type: 'chart', option: snapshot.chart_config });
            }
        }
        const signature = usageSignature(snapshot.usage);
        if (signature !== '' && signature !== cursor.usageSignature) {
            cursor.usageSignature = signature;
            emit({ type: 'usage', usage: mapUsage(snapshot.usage) });
        }
        if (snapshot.status === exports.AGENTIC_STATUS.COMPLETED)
            emit({ type: 'done', turnId });
        else if (snapshot.status === exports.AGENTIC_STATUS.ERRORED) {
            emit({
                type: 'error',
                error: { message: snapshot.error ?? 'The copilot run failed.' },
            });
        }
        else if (snapshot.status === exports.AGENTIC_STATUS.CANCELLED)
            emit({ type: 'cancelled' });
        return events;
    }
}
exports.AgenticTransport = AgenticTransport;
function emitStepPair(emit, step) {
    // Polling only ever sees finished tool calls, so the timeline gets the completed form.
    emit({ type: 'step_result', step: { ...step, status: 'ok' } });
}
function isTerminalStatus(status) {
    return (status === exports.AGENTIC_STATUS.COMPLETED ||
        status === exports.AGENTIC_STATUS.ERRORED ||
        status === exports.AGENTIC_STATUS.CANCELLED);
}
function readStepId(entry, index) {
    const callId = entry.call_id ?? entry.callId;
    if (typeof callId === 'string' && callId !== '')
        return callId;
    return `step-${index}`;
}
function readStepTitle(entry, index) {
    if (typeof entry.tool === 'string' && entry.tool !== '')
        return entry.tool;
    if (typeof entry.detail === 'string' && entry.detail !== '')
        return entry.detail;
    return `Step ${index + 1}`;
}
function readNumber(scope, key) {
    const value = scope[key];
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        return Number(value);
    }
    return undefined;
}
function mapUsage(usage) {
    if (!usage)
        return {};
    const mapped = {};
    if (typeof usage.prompt_tokens === 'number')
        mapped.tokensIn = usage.prompt_tokens;
    if (typeof usage.completion_tokens === 'number')
        mapped.tokensOut = usage.completion_tokens;
    if (typeof usage.calls === 'number')
        mapped.calls = usage.calls;
    if (typeof usage.cost_usd === 'number')
        mapped.costUsd = usage.cost_usd;
    return mapped;
}
function truncate(value, max) {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
// A stable key for one prompt from one user, so a retried create replays instead of re-running.
function buildIdempotencyKey(organizationId, userId, prompt) {
    let hash = 5381;
    for (let index = 0; index < prompt.length; index += 1) {
        hash = ((hash << 5) + hash + prompt.charCodeAt(index)) >>> 0;
    }
    return `nxcp-${organizationId}-${userId}-${hash.toString(36)}-${Date.now().toString(36)}`;
}
