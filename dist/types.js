"use strict";
// Core domain types for the NETIX copilot.
// The event vocabulary here mirrors exactly what ml-engine emits over SSE.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPILOT_EVENT_NAMES = exports.MODEL_TIERS = void 0;
exports.modelTierMetadata = modelTierMetadata;
exports.MODEL_TIERS = [
    { key: 'base', label: 'Base 1x', multiplier: 1 },
    { key: 'high', label: 'High 5x', multiplier: 5 },
    { key: 'max', label: 'Max 20x', multiplier: 20 },
];
function modelTierMetadata(tier) {
    return exports.MODEL_TIERS.find((entry) => entry.key === tier) ?? exports.MODEL_TIERS[0];
}
// Every event name the backend can emit. `plan` is optional in the sense that a run may
// never emit it -- the direct router bypasses the orchestrator -- so nothing may block on it.
// `agent_started` / `agent_finished` arrive only from an ml-engine that tags specialist runs;
// an older backend never sends them and the trace still renders from the step events alone.
exports.COPILOT_EVENT_NAMES = [
    'run_started',
    'queued',
    'plan',
    'agent_started',
    'agent_finished',
    'step_started',
    'step_result',
    'message_delta',
    'chart',
    'usage',
    'done',
    'error',
    'cancelled',
];
