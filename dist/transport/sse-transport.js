"use strict";
// The streaming transport.
//
// Re-checked against ml-engine's feat/copilot-w2-memory-and-actions branch on 2026-08-21. The
// stream, cancel, approval and thread routes all exist and the defaults below are now the paths
// ml-engine actually registers. The one route that does not exist is the create: there is no
// POST /api/copilot/turns/, because a turn is opened through the agentic request resource and
// its response carries the turn_id to tail. `auto` therefore still degrades to the poll
// transport on the first send, which is why that default is left pointing at the blueprint path
// rather than at a route that would half-work.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseTransport = exports.DEFAULT_SSE_ENDPOINTS = void 0;
const decode_1 = require("./decode");
const http_1 = require("./http");
const sse_1 = require("./sse");
const transcript_1 = require("./transcript");
const types_1 = require("./types");
// The paths ml-engine registers, verified against service/urls.py and service/copilot/sse.py.
// Note the two spellings: the DRF router registers `copilot-turn`, while the SSE endpoint is
// served ahead of Django by the ASGI path router at `copilot/turn` with no trailing slash.
exports.DEFAULT_SSE_ENDPOINTS = {
    createTurn: '/api/copilot/turns/',
    streamTurn: '/api/copilot/turn/{turnId}/events',
    pollTurn: '/api/copilot-turn/{turnId}/events/',
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
    async createTurn(input, signal) {
        const body = { prompt: input.prompt };
        if (input.threadId !== undefined)
            body.thread_id = input.threadId;
        if (input.scope !== undefined)
            body.scope = input.scope;
        const payload = await (0, http_1.requestJson)(this.config, this.endpoints.createTurn, {
            method: 'POST',
            body,
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
        const payload = await (0, http_1.requestJson)(this.config, path, {
            ...(signal ? { signal } : {}),
        });
        const rows = Array.isArray(payload)
            ? payload
            : isRecord(payload) && Array.isArray(payload.results)
                ? payload.results
                : [];
        return rows.filter(isRecord).map((row, index) => (0, transcript_1.turnFromRow)(row, threadId, index));
    }
    async listThreads(signal) {
        const payload = await (0, http_1.requestJson)(this.config, this.endpoints.threads, {
            ...(signal ? { signal } : {}),
        });
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
    async consumeRun(options) {
        options.onTransportChange?.('sse');
        try {
            await this.consumeByStreaming(options);
        }
        catch (error) {
            if (options.signal.aborted)
                return;
            // A missing or non-SSE stream route still has a cursor-poll sibling in this contract.
            if (error instanceof http_1.CopilotHttpError && error.isRouteMissing) {
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
    async consumeByCursorPolling(options) {
        const base = options.pollUrl ?? (0, types_1.fillTemplate)(this.endpoints.pollTurn, { turnId: options.turnId });
        const interval = this.config.pollIntervalMs ?? 1000;
        let cursor = options.lastEventId;
        let idleRounds = 0;
        while (!options.signal.aborted) {
            const query = cursor === undefined ? '' : `?after=${encodeURIComponent(cursor)}`;
            const payload = await (0, http_1.requestJson)(this.config, `${base}${query}`, {
                signal: options.signal,
            });
            const rows = payload.events ?? payload.results ?? [];
            let terminal = false;
            for (const row of rows) {
                const decoded = (0, decode_1.decodePolledEvent)(row);
                if (!decoded)
                    continue;
                if (decoded.id !== undefined)
                    cursor = decoded.id;
                if ((0, types_1.isTerminalEvent)(decoded))
                    terminal = true;
                options.onEvent(decoded);
            }
            cursor = payload.next_cursor ?? payload.nextCursor ?? payload.cursor ?? cursor;
            if (terminal || payload.done === true)
                return;
            idleRounds = rows.length === 0 ? Math.min(idleRounds + 1, 3) : 0;
            await this.sleepImpl(interval * 2 ** idleRounds, options.signal);
        }
    }
}
exports.SseTransport = SseTransport;
