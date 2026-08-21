"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunBadges = RunBadges;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
function formatSeconds(ms) {
    if (ms < 1000)
        return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}
// The status, timing and tool chips the per-app drawers showed under every answer. They are the
// only evidence a user has that a slow turn was actually working, so an adopting host should not
// have to rebuild them.
function RunBadges({ run }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const showStatus = run.status !== 'idle' && run.status !== 'creating';
    // Timing is only meaningful once the run stopped; mid-run it would tick a stale number.
    const showDuration = run.executionMs !== undefined &&
        (run.status === 'done' || run.status === 'error' || run.status === 'cancelled');
    const tools = run.tools ?? [];
    if (!showStatus && !showDuration && tools.length === 0)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-badges', children: [showStatus ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-badge', "data-run-status": run.status, children: t(`copilot.run.status.${run.status}`) })) : null, showDuration && run.executionMs !== undefined ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-badge', children: formatSeconds(run.executionMs) })) : null, tools.map((tool) => ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-badge', "data-tone": 'tool', children: tool }, tool)))] }));
}
