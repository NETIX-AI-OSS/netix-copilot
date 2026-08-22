"use strict";
// The streaming transport, re-verified against ml-engine on 2026-08-22.
// Every route below is one ml-engine registers: the DRF router mounts `copilot-turn` and `copilot-conversation`,
// and the SSE tail is served by the ASGI path router in service/mcp_server/asgi.py, ahead of Django and with no trailing slash.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseTransport = exports.DEFAULT_SSE_ENDPOINTS = void 0;
const decode_1 = require("./decode");
const http_1 = require("./http");
const run_diff_1 = require("./run-diff");
const sse_1 = require("./sse");
const transcript_1 = require("./transcript");
const types_1 = require("./types");
// Note the two spellings: the DRF router registers `copilot-turn`, the ASGI SSE route is `copilot/turn`.
exports.DEFAULT_SSE_ENDPOINTS = {
    createTurn: '/api/copilot-turn/',
    streamTurn: '/api/copilot/turn/{turnId}/events',
    pollTurn: '/api/copilot-turn/{turnId}/',
    cancelTurn: '/api/copilot-turn/{turnId}/cancel/',
    approval: '/api/copilot-turn/{turnId}/steps/{stepId}/approval/',
    threads: '/api/copilot-conversation/',
    threadTurns: '/api/copilot-turn/?conversation={threadId}',
};
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readString(source, keys) {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value !== '')
            return value;
        if (typeof value === 'number' && Number.isFinite(value))
            return String(value);
    }
    return undefined;
}
class SseTransport {
    constructor(config) {
        this.name = 'sse';
        this.config = config;
        this.endpoints = { ...exports.DEFAULT_SSE_ENDPOINTS, ...config.endpoints };
        this.sleepImpl = config.sleepImpl ?? types_1.sleep;
    }
    // CopilotAskSerializer takes prompt/thread_id and declares no scope field, so page context
    // reaches the model through the prompt itself rather than through a key DRF would drop.
    async createTurn(input, signal) {
        const body = { prompt: input.prompt };
        if (input.threadId !== undefined)
            body.thread_id = input.threadId;
        const payload = await (0, http_1.requestJson)(this.config, this.endpoints.createTurn, {
            method: 'POST',
            body,
            // ml-engine claims this key before it spends anything, so a repeated create replays the run.
            headers: { 'Idempotency-Key': input.idempotencyKey ?? (0, types_1.newIdempotencyKey)() },
            ...(signal ? { signal } : {}),
        });
        if (!isRecord(payload))
            throw new Error('Copilot create-turn returned an unexpected payload.');
        const turnId = readString(payload, ['turn_id', 'turnId', 'id', 'run_id']);
        if (turnId === undefined)
            throw new Error('Copilot create-turn response carried no turn id.');
        const created = { turnId };
        const threadId = readString(payload, ['thread_id', 'threadId']);
        if (threadId !== undefined)
            created.threadId = threadId;
        const streamUrl = readString(payload, ['stream_url', 'streamUrl']);
        if (streamUrl !== undefined)
            created.streamUrl = streamUrl;
        const pollUrl = readString(payload, ['poll_url', 'pollUrl', 'events_url']);
        if (pollUrl !== undefined)
            created.pollUrl = pollUrl;
        return created;
    }
    async cancelTurn(turnId) {
        await (0, http_1.request)(this.config, (0, types_1.fillTemplate)(this.endpoints.cancelTurn, { turnId }), {
            method: 'POST',
        }).catch(() => undefined);
    }
    // ml-engine accepts either key and prefers `approved` when both arrive; sending both keeps the
    // request readable in a log and tolerant of whichever half a proxy strips.
    async respondToApproval(turnId, stepId, approved) {
        await (0, http_1.request)(this.config, (0, types_1.fillTemplate)(this.endpoints.approval, { turnId, stepId }), {
            method: 'POST',
            body: { approved, decision: approved ? 'approve' : 'reject' },
        });
    }
    // A thread's history is its turn list. Every row already carries the plan, the execution log,
    // the chart and the timing, so a replayed turn renders through the same components as a live
    // one instead of degrading to plain text.
    async fetchThread(threadId, signal) {
        const path = (0, types_1.fillTemplate)(this.endpoints.threadTurns, {
            threadId: encodeURIComponent(threadId),
        });
        const payload = await this.readOrEmpty(path, signal);
        const rows = Array.isArray(payload)
            ? payload
            : isRecord(payload) && Array.isArray(payload.results)
                ? payload.results
                : [];
        return rows.filter(isRecord).map((row, index) => (0, transcript_1.turnFromRow)(row, threadId, index));
    }
    async listThreads(signal) {
        const payload = await this.readOrEmpty(this.endpoints.threads, signal);
        const rows = Array.isArray(payload)
            ? payload
            : isRecord(payload) && Array.isArray(payload.results)
                ? payload.results
                : [];
        return rows.filter(isRecord).map((row) => {
            const updatedRaw = readString(row, [
                'last_activity_at',
                'updated_on',
                'updated_at',
                'updatedAt',
                'created_on',
                'created_at',
            ]);
            const parsed = updatedRaw === undefined ? Number.NaN : Date.parse(updatedRaw);
            const thread = {
                id: readString(row, ['id', 'thread_id', 'threadId']) ?? '',
                title: readString(row, ['title', 'name', 'summary']) ?? 'Untitled',
                updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
            };
            const count = row.message_count ?? row.messageCount ?? row.turn_count;
            if (typeof count === 'number')
                thread.messageCount = count;
            return thread;
        });
    }
    // A thread read that 404s means this cluster serves no thread store, which is an empty
    // history rather than a failure. The dock is mounted on every route, so it must not throw.
    async readOrEmpty(path, signal) {
        try {
            return await (0, http_1.requestJson)(this.config, path, { ...(signal ? { signal } : {}) });
        }
        catch (error) {
            if ((0, http_1.isRouteMissing)(error))
                return undefined;
            throw error;
        }
    }
    async consumeRun(options) {
        options.onTransportChange?.('sse');
        try {
            await this.consumeByStreaming(options);
        }
        catch (error) {
            if (options.signal.aborted)
                return;
            // No stream to tail: the run itself is still readable, so fall back to polling the turn.
            if ((0, http_1.isRouteMissing)(error)) {
                await this.consumeByCursorPolling(options);
                return;
            }
            if (error instanceof types_1.NotStreamableError) {
                await this.consumeByCursorPolling(options);
                return;
            }
            throw error;
        }
    }
    async consumeByStreaming(options) {
        const path = options.streamUrl ?? (0, types_1.fillTemplate)(this.endpoints.streamTurn, { turnId: options.turnId });
        const headers = await (0, http_1.buildHeaders)(this.config, {
            Accept: 'text/event-stream',
            // Resume rather than replay: the server continues after the last event we actually saw.
            ...(options.lastEventId === undefined ? {} : { 'Last-Event-ID': options.lastEventId }),
        });
        const fetchImpl = this.config.fetchImpl ?? ((url, init) => fetch(url, init));
        const response = await fetchImpl((0, http_1.joinUrl)(this.config.baseUrl, path), {
            method: 'GET',
            headers,
            signal: options.signal,
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new http_1.CopilotHttpError(response.status, body);
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.toLowerCase().includes('text/event-stream')) {
            throw new types_1.NotStreamableError(`Stream endpoint answered with content-type "${contentType}".`);
        }
        if (!response.body)
            throw new types_1.NotStreamableError('Stream endpoint returned no readable body.');
        const parser = new sse_1.SseParser();
        parser.setLastEventId(options.lastEventId);
        let terminal = false;
        await (0, sse_1.readSseStream)(response.body, (frame) => {
            const decoded = (0, decode_1.decodeFrame)(frame);
            if (!decoded)
                return;
            if ((0, types_1.isTerminalEvent)(decoded))
                terminal = true;
            options.onEvent(decoded);
        }, { parser, signal: options.signal });
        if (!terminal && !options.signal.aborted) {
            throw new types_1.StreamInterruptedError(parser.getLastEventId());
        }
    }
    // ml-engine registers no cursor-poll route: `pollTurn` is the run's own detail, and a poll of it
    // is diffed exactly the way the agentic transport diffs its resource. An event page is still
    // accepted, so a host that points `pollTurn` at one of its own keeps working.
    async consumeByCursorPolling(options) {
        const base = options.pollUrl ?? (0, types_1.fillTemplate)(this.endpoints.pollTurn, { turnId: options.turnId });
        const interval = this.config.pollIntervalMs ?? 1000;
        let cursor = options.lastEventId;
        const snapshotCursor = (0, run_diff_1.decodeCursor)(options.lastEventId);
        let snapshotMode = false;
        let idleRounds = 0;
        while (!options.signal.aborted) {
            // A run detail takes no cursor query; only an event page is asked to resume from one.
            const query = cursor === undefined || snapshotMode ? '' : `?after=${encodeURIComponent(cursor)}`;
            const payload = await (0, http_1.requestJson)(this.config, `${base}${query}`, { signal: options.signal });
            const page = payload.events ?? payload.results;
            let emitted = 0;
            let terminal = false;
            if (page === undefined) {
                snapshotMode = true;
                for (const enveloped of (0, run_diff_1.diffRunSnapshot)(payload, snapshotCursor, options.turnId)) {
                    emitted += 1;
                    if (enveloped.id !== undefined)
                        cursor = enveloped.id;
                    options.onEvent(enveloped);
                }
                if ((0, run_diff_1.isTerminalStatus)(payload.status))
                    return;
            }
            else {
                for (const row of page) {
                    const decoded = (0, decode_1.decodePolledEvent)(row);
                    if (!decoded)
                        continue;
                    emitted += 1;
                    if (decoded.id !== undefined)
                        cursor = decoded.id;
                    if ((0, types_1.isTerminalEvent)(decoded))
                        terminal = true;
                    options.onEvent(decoded);
                }
                cursor = payload.next_cursor ?? payload.nextCursor ?? payload.cursor ?? cursor;
                if (terminal || payload.done === true)
                    return;
            }
            idleRounds = emitted === 0 ? Math.min(idleRounds + 1, 3) : 0;
            await this.sleepImpl(interval * 2 ** idleRounds, options.signal);
        }
    }
}
exports.SseTransport = SseTransport;
