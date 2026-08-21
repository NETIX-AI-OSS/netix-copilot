"use strict";
// Every string the dock renders, with an English default.
//
// The `t` adapter is required so hosts can route these through their own i18next catalogue, but
// nobody should have to discover the key list by reading components. Pass
// createFallbackTranslate() while wiring a host, then swap in the real t once the keys are
// translated.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPILOT_STRINGS = void 0;
exports.interpolate = interpolate;
exports.createFallbackTranslate = createFallbackTranslate;
exports.COPILOT_STRINGS = {
    'copilot.dock.title': 'Copilot',
    'copilot.dock.label': 'Copilot assistant',
    'copilot.dock.open': 'Ask Copilot',
    'copilot.dock.close': 'Close copilot',
    'copilot.dock.new': 'New',
    'copilot.dock.resize': 'Resize copilot dock',
    'copilot.dock.empty': 'Ask about anything on this page.',
    'copilot.composer.label': 'Message',
    'copilot.composer.placeholder': 'Ask about this page…',
    'copilot.composer.send': 'Send',
    'copilot.composer.stop': 'Stop',
    'copilot.threads.label': 'Conversations',
    'copilot.threads.loading': 'Loading conversations…',
    'copilot.threads.empty': 'No earlier conversations.',
    'copilot.plan.label': 'Plan',
    'copilot.steps.label': 'Steps',
    'copilot.status.thinking': 'Working…',
    'copilot.status.queued': 'Queued.',
    'copilot.status.queuedAt': 'Queued at position {position}.',
    'copilot.status.offline': 'Offline. The answer resumes when the connection returns.',
    'copilot.status.cancelled': 'Cancelled.',
    'copilot.approval.label': 'Approval required',
    'copilot.approval.approve': 'Approve',
    'copilot.approval.reject': 'Reject',
    'copilot.approval.failed': 'The approval could not be recorded.',
    'copilot.usage.tokens': '{in} in / {out} out',
    'copilot.usage.calls': '{count} calls',
    'copilot.usage.credits': '{count} credits left',
    'copilot.transport.sse': 'streaming',
    'copilot.transport.agentic': 'polling',
    'copilot.step.status.pending': 'Pending',
    'copilot.step.status.running': 'Running',
    'copilot.step.status.ok': 'Done',
    'copilot.step.status.error': 'Failed',
    'copilot.step.status.skipped': 'Skipped',
    'copilot.step.status.awaiting_approval': 'Waiting for approval',
    'copilot.step.status.rejected': 'Rejected',
    'copilot.step.status.cancelled': 'Cancelled',
};
function interpolate(template, vars) {
    if (!vars)
        return template;
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = vars[key];
        return value === undefined ? match : String(value);
    });
}
// A translate function backed by the defaults above, for bring-up and for tests.
function createFallbackTranslate(overrides = {}) {
    const table = { ...exports.COPILOT_STRINGS, ...overrides };
    return (key, vars) => interpolate(table[key] ?? key, vars);
}
