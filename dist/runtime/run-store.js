"use strict";
// The pure reduction from events to renderable run state.
// Kept free of React and of the network so it can be tested as a table of event sequences.
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialRunState = initialRunState;
exports.applyEvent = applyEvent;
exports.applyEnveloped = applyEnveloped;
exports.isRunActive = isRunActive;
exports.isRunFinished = isRunFinished;
function initialRunState() {
    return {
        status: 'idle',
        hasPlan: false,
        steps: [],
        text: '',
        charts: [],
        offline: false,
    };
}
function upsertStep(steps, incoming) {
    const index = steps.findIndex((step) => step.id === incoming.id);
    if (index === -1)
        return [...steps, incoming];
    const next = steps.slice();
    // A later event only fills gaps: a step_result that omits the title keeps the planned one.
    next[index] = { ...next[index], ...incoming };
    return next;
}
function mergeUsage(current, incoming) {
    return { ...current, ...incoming };
}
// Only the keys the terminal payload actually carried, so a summary that omits execution_time
// does not blank one an earlier event already recorded.
function applySummary(summary) {
    const patch = {};
    if (summary.tools !== undefined)
        patch.tools = summary.tools;
    if (summary.executionMs !== undefined)
        patch.executionMs = summary.executionMs;
    if (summary.resultData !== undefined)
        patch.resultData = summary.resultData;
    return patch;
}
function applyEvent(state, event) {
    switch (event.type) {
        case 'run_started': {
            const next = { ...state, status: 'streaming', turnId: event.turnId };
            if (event.model !== undefined)
                next.model = event.model;
            if (event.creditsRemaining !== undefined) {
                next.usage = mergeUsage(state.usage, { creditsRemaining: event.creditsRemaining });
            }
            return next;
        }
        case 'queued': {
            const next = { ...state, status: 'queued' };
            if (event.position !== undefined)
                next.queuePosition = event.position;
            return next;
        }
        case 'plan':
            // A run without a plan is normal: the direct router answers single-domain prompts without
            // ever consulting the orchestrator. Nothing may wait on this event.
            return {
                ...state,
                hasPlan: true,
                status: state.status === 'queued' ? 'streaming' : state.status,
                steps: event.steps.reduce(upsertStep, state.steps),
            };
        case 'step_started':
        case 'step_result':
            return {
                ...state,
                status: state.status === 'queued' ? 'streaming' : state.status,
                steps: upsertStep(state.steps, event.step),
            };
        case 'message_delta':
            return {
                ...state,
                status: state.status === 'queued' ? 'streaming' : state.status,
                text: state.text + event.text,
            };
        case 'chart': {
            const id = event.chartId ?? `chart-${state.charts.length + 1}`;
            if (state.charts.some((chart) => chart.id === id))
                return state;
            const chart = { id, option: event.option, ...(event.title ? { title: event.title } : {}) };
            return { ...state, charts: [...state.charts, chart] };
        }
        case 'usage':
            return { ...state, usage: mergeUsage(state.usage, event.usage) };
        case 'done':
            return { ...state, ...applySummary(event), status: 'done', offline: false };
        case 'error':
            return {
                ...state,
                ...applySummary(event),
                status: 'error',
                error: event.error,
                offline: false,
            };
        case 'cancelled':
            return { ...state, status: 'cancelled', offline: false };
        default:
            return state;
    }
}
function applyEnveloped(state, enveloped) {
    const next = applyEvent(state, enveloped.event);
    if (enveloped.id === undefined)
        return next;
    return next === state
        ? { ...state, lastEventId: enveloped.id }
        : { ...next, lastEventId: enveloped.id };
}
const ACTIVE_STATUSES = new Set(['creating', 'queued', 'streaming']);
// True while the run should be holding a connection open.
function isRunActive(state) {
    return ACTIVE_STATUSES.has(state.status);
}
// True once the run has stopped for good. Distinct from isRunActive because a paused run is
// neither active nor finished.
function isRunFinished(state) {
    return state.status === 'done' || state.status === 'error' || state.status === 'cancelled';
}
