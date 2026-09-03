"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanTimeline = PlanTimeline;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const trace_labels_1 = require("./trace-labels");
function PlanTimeline({ steps, hasPlan }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    if (steps.length === 0)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-timeline', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-sr-only', children: hasPlan ? t('copilot.plan.label') : t('copilot.steps.label') }), (0, jsx_runtime_1.jsx)("ol", { style: { listStyle: 'none', margin: 0, padding: 0, display: 'contents' }, children: steps.map((step) => {
                    const duration = step.durationMs === undefined ? undefined : (0, trace_labels_1.formatDuration)(step.durationMs);
                    return ((0, jsx_runtime_1.jsxs)("li", { className: 'nxcp-step', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-dot', "data-status": step.status, "aria-hidden": 'true' }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-step-tool', children: step.tool ?? step.title }), step.argsSummary ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-step-args', children: step.argsSummary }) : null, duration ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-step-duration', children: duration }) : null, (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-sr-only', children: t(`copilot.step.status.${step.status}`) })] }, step.id));
                }) })] }));
}
