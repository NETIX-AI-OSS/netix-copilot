"use strict";
// Core domain types for the NETIX copilot.
// The event vocabulary here mirrors exactly what ml-engine emits over SSE.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPILOT_EVENT_NAMES = void 0;
// Every event name the backend can emit. `plan` is optional in the sense that a run may
// never emit it -- the direct router bypasses the orchestrator -- so nothing may block on it.
exports.COPILOT_EVENT_NAMES = [
    'run_started',
    'queued',
    'plan',
    'step_started',
    'step_result',
    'message_delta',
    'chart',
    'usage',
    'done',
    'error',
    'cancelled',
];
