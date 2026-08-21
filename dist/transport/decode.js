"use strict";
// Maps raw SSE frames onto the copilot event vocabulary.
// The decoder is deliberately tolerant: it accepts the snake_case the Python backend emits and
// the camelCase a hand-written mock might send, and it accepts step payloads either flat or
// nested under a `step` key. A frame it cannot understand is dropped, never thrown, because one
// malformed frame must not kill a run that is otherwise streaming fine.
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetSyntheticStepCounter = resetSyntheticStepCounter;
exports.decodeFrame = decodeFrame;
exports.decodePolledEvent = decodePolledEvent;
const types_1 = require("../types");
const result_data_1 = require("./result-data");
const EVENT_NAMES = new Set(types_1.COPILOT_EVENT_NAMES);
const STEP_STATUSES = new Set([
    'pending',
    'running',
    'ok',
    'error',
    'skipped',
    'awaiting_approval',
    'rejected',
    'cancelled',
]);
// Statuses the backend may spell differently but that mean the same thing to the dock.
const STATUS_ALIASES = {
    success: 'ok',
    succeeded: 'ok',
    completed: 'ok',
    complete: 'ok',
    done: 'ok',
    failed: 'error',
    failure: 'error',
    errored: 'error',
    started: 'running',
    in_progress: 'running',
    needs_approval: 'awaiting_approval',
    pending_approval: 'awaiting_approval',
    requires_approval: 'awaiting_approval',
    denied: 'rejected',
    canceled: 'cancelled',
};
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function pick(source, keys) {
    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null)
            return value;
    }
    return undefined;
}
function asString(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return undefined;
}
function asNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return undefined;
}
function asStatus(value, fallback) {
    const raw = asString(value);
    if (raw === undefined)
        return fallback;
    const normalized = raw.toLowerCase();
    if (STEP_STATUSES.has(normalized))
        return normalized;
    return STATUS_ALIASES[normalized] ?? fallback;
}
function asJsonObject(value) {
    return isRecord(value) ? value : undefined;
}
let syntheticStepCounter = 0;
// Exported so tests can make step ids deterministic.
function resetSyntheticStepCounter() {
    syntheticStepCounter = 0;
}
// execution_log entries from ml-engine are { tool, call_id, iteration, arguments, output }, so
// `arguments` arrives as an object and has to be flattened into a one-line summary here.
function summarizeArguments(value) {
    if (typeof value === 'string')
        return value === '' ? undefined : value;
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
    return summary.length > 160 ? `${summary.slice(0, 159)}…` : summary;
}
// ml-engine sends call_id on both step_started and step_result for the same tool call, so it is
// the only key guaranteed stable across the pair. Preferring it is what collapses the two events
// into one timeline entry; an id read off the event itself would differ between them.
const STEP_ID_KEYS = ['call_id', 'callId', 'id', 'step_id', 'stepId', 'index'];
function readStepId(source, nested) {
    for (const key of STEP_ID_KEYS) {
        const value = asString(pick(nested, [key])) ?? asString(pick(source, [key]));
        if (value !== undefined && value !== '')
            return value;
    }
    // Only reached when the backend supplied no id at all. Synthesis is the last resort because it
    // is exactly what makes one tool call render twice.
    return `step-${(syntheticStepCounter += 1)}`;
}
function decodeStep(source, fallbackStatus) {
    const nested = isRecord(source.step) ? source.step : source;
    const tool = asString(pick(nested, ['tool', 'tool_name', 'toolName', 'name']));
    const id = readStepId(source, nested);
    const step = {
        id,
        title: asString(pick(nested, ['title', 'label', 'description', 'summary'])) ??
            tool ??
            asString(nested.detail) ??
            id,
        status: asStatus(pick(nested, ['status', 'state']), fallbackStatus),
    };
    if (tool !== undefined)
        step.tool = tool;
    const argsSummary = summarizeArguments(pick(nested, ['args_summary', 'argsSummary', 'arguments_summary', 'args', 'arguments']));
    if (argsSummary !== undefined)
        step.argsSummary = argsSummary;
    const durationMs = asNumber(pick(nested, ['duration_ms', 'durationMs'])) ??
        // A bare `duration` is seconds by convention on this backend.
        (() => {
            const seconds = asNumber(pick(nested, ['duration', 'elapsed']));
            return seconds === undefined ? undefined : Math.round(seconds * 1000);
        })();
    if (durationMs !== undefined)
        step.durationMs = durationMs;
    const detail = asString(pick(nested, ['detail', 'result', 'message', 'output']));
    if (detail !== undefined)
        step.detail = detail;
    return step;
}
function decodeUsage(source) {
    const nested = isRecord(source.usage) ? source.usage : source;
    const usage = {};
    const creditsUsed = asNumber(pick(nested, ['credits_used', 'creditsUsed', 'credits']));
    if (creditsUsed !== undefined)
        usage.creditsUsed = creditsUsed;
    const creditsRemaining = asNumber(pick(nested, ['credits_remaining', 'creditsRemaining', 'remaining_credits']));
    if (creditsRemaining !== undefined)
        usage.creditsRemaining = creditsRemaining;
    const tokensIn = asNumber(pick(nested, ['tokens_in', 'tokensIn', 'prompt_tokens', 'input_tokens']));
    if (tokensIn !== undefined)
        usage.tokensIn = tokensIn;
    const tokensOut = asNumber(pick(nested, ['tokens_out', 'tokensOut', 'completion_tokens', 'output_tokens']));
    if (tokensOut !== undefined)
        usage.tokensOut = tokensOut;
    const calls = asNumber(pick(nested, ['calls', 'llm_calls', 'llmCalls', 'round_trips']));
    if (calls !== undefined)
        usage.calls = calls;
    const costUsd = asNumber(pick(nested, ['cost_usd', 'costUsd', 'cost']));
    if (costUsd !== undefined)
        usage.costUsd = costUsd;
    const model = asString(pick(nested, ['model', 'model_name']));
    if (model !== undefined)
        usage.model = model;
    return usage;
}
// The run-level facts ml-engine hangs off the terminal payload rather than off an event of
// their own. Absent keys stay absent: an omitted execution_time is unknown, not zero.
function decodeRunSummary(source) {
    const summary = {};
    const tools = pick(source, ['tools', 'tools_used', 'toolsUsed']);
    if (Array.isArray(tools)) {
        const names = tools.map(asString).filter((name) => name !== undefined);
        if (names.length > 0)
            summary.tools = names;
    }
    const executionMs = asNumber(pick(source, ['execution_ms', 'executionMs', 'duration_ms']));
    if (executionMs !== undefined)
        summary.executionMs = executionMs;
    else {
        const seconds = asNumber(pick(source, ['execution_time', 'executionTime', 'duration']));
        if (seconds !== undefined)
            summary.executionMs = Math.round(seconds * 1000);
    }
    const resultData = (0, result_data_1.normalizeResultData)(pick(source, ['result_data', 'resultData']));
    if (resultData !== undefined)
        summary.resultData = resultData;
    return summary;
}
function decodeError(source) {
    const nested = isRecord(source.error) ? source.error : source;
    const error = {
        message: asString(pick(nested, ['message', 'detail', 'error', 'reason'])) ?? 'The copilot run failed.',
    };
    const code = asString(pick(nested, ['code', 'error_code', 'errorCode']));
    if (code !== undefined)
        error.code = code;
    const retryable = pick(nested, ['retryable', 'can_retry', 'canRetry']);
    if (typeof retryable === 'boolean')
        error.retryable = retryable;
    return error;
}
// Resolve the event name from the SSE `event:` field, falling back to a `type` inside the payload.
function resolveEventName(frame, payload) {
    if (EVENT_NAMES.has(frame.event))
        return frame.event;
    const embedded = asString(pick(payload, ['type', 'event', 'name']));
    if (embedded !== undefined && EVENT_NAMES.has(embedded))
        return embedded;
    return null;
}
function toEvent(name, payload) {
    switch (name) {
        case 'run_started': {
            const turnId = asString(pick(payload, ['turn_id', 'turnId', 'id', 'run_id', 'runId']));
            if (turnId === undefined)
                return null;
            const event = { type: 'run_started', turnId };
            const model = asString(pick(payload, ['model', 'model_name']));
            if (model !== undefined)
                event.model = model;
            const credits = asNumber(pick(payload, ['credits_remaining', 'creditsRemaining']));
            if (credits !== undefined)
                event.creditsRemaining = credits;
            return event;
        }
        case 'queued': {
            const event = { type: 'queued' };
            const position = asNumber(pick(payload, ['position', 'queue_position', 'queuePosition']));
            if (position !== undefined)
                event.position = position;
            return event;
        }
        case 'plan': {
            const raw = pick(payload, ['steps', 'plan', 'items']);
            const list = Array.isArray(raw) ? raw : [];
            const steps = list.filter(isRecord).map((entry) => decodeStep(entry, 'pending'));
            return { type: 'plan', steps };
        }
        case 'step_started':
            return { type: 'step_started', step: decodeStep(payload, 'running') };
        case 'step_result':
            return { type: 'step_result', step: decodeStep(payload, 'ok') };
        case 'message_delta': {
            const text = asString(pick(payload, ['text', 'delta', 'content', 'chunk', 'token']));
            if (text === undefined)
                return null;
            return { type: 'message_delta', text };
        }
        case 'chart': {
            // ml-engine wraps the ECharts option once, as { chart_config: { ... } }.
            const option = asJsonObject(pick(payload, [
                'chart_config',
                'chartConfig',
                'option',
                'options',
                'chart',
                'config',
                'spec',
            ]));
            if (option === undefined)
                return null;
            const event = { type: 'chart', option };
            const title = asString(pick(payload, ['title', 'name']));
            if (title !== undefined)
                event.title = title;
            const chartId = asString(pick(payload, ['id', 'chart_id', 'chartId']));
            if (chartId !== undefined)
                event.chartId = chartId;
            return event;
        }
        case 'usage':
            return { type: 'usage', usage: decodeUsage(payload) };
        case 'done': {
            const event = { type: 'done', ...decodeRunSummary(payload) };
            const turnId = asString(pick(payload, ['turn_id', 'turnId', 'id']));
            if (turnId !== undefined)
                event.turnId = turnId;
            return event;
        }
        case 'error':
            return { type: 'error', error: decodeError(payload), ...decodeRunSummary(payload) };
        case 'cancelled': {
            const event = { type: 'cancelled' };
            const reason = asString(pick(payload, ['reason', 'message', 'detail']));
            if (reason !== undefined)
                event.reason = reason;
            return event;
        }
        default:
            return null;
    }
}
// Decode one SSE frame. Returns null for keep-alives, unknown events and malformed payloads.
function decodeFrame(frame) {
    let parsed;
    if (frame.data.trim() === '') {
        parsed = {};
    }
    else {
        try {
            parsed = JSON.parse(frame.data);
        }
        catch {
            return null;
        }
    }
    const payload = isRecord(parsed) ? parsed : { value: parsed };
    const name = resolveEventName(frame, payload);
    if (name === null)
        return null;
    // Backends commonly nest the real payload under `data`, so merge that layer in when present.
    const merged = isRecord(payload.data) ? { ...payload, ...payload.data } : payload;
    const event = toEvent(name, merged);
    if (event === null)
        return null;
    return frame.id === undefined ? { event } : { event, id: frame.id };
}
// Decode a polled JSON event, which arrives already shaped as { event | type, ...payload }.
function decodePolledEvent(value) {
    if (!isRecord(value))
        return null;
    const name = asString(pick(value, ['event', 'type', 'name'])) ?? '';
    const id = asString(pick(value, ['id', 'event_id', 'eventId', 'cursor', 'seq']));
    const data = isRecord(value.data) ? { ...value, ...value.data } : value;
    return decodeFrame({
        event: name,
        data: JSON.stringify(data),
        ...(id === undefined ? {} : { id }),
    });
}
