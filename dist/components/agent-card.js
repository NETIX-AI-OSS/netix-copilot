"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCard = AgentCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const trace_model_1 = require("../runtime/trace-model");
const status_glyph_1 = require("./status-glyph");
const trace_labels_1 = require("./trace-labels");
// The meta-tool name is the surest signal of which specialist this is: `agent` on a delegation
// step may name the caller rather than the callee, depending on which event upserted it.
function specialistName(step) {
    if (step.tool !== undefined && (0, trace_model_1.agentKey)(step.tool) !== undefined)
        return step.tool;
    return step.agent ?? step.tool ?? step.title;
}
function AgentCard({ step, nowMs, children }) {
    const { t, labels } = (0, context_1.useCopilotAdapters)();
    const name = specialistName(step);
    const domain = (0, trace_labels_1.agentDomain)((0, trace_model_1.agentKey)(name) ?? name);
    const label = (0, trace_labels_1.agentLabel)(t, labels, name);
    const elapsed = (0, trace_model_1.stepElapsedMs)(step, nowMs);
    return ((0, jsx_runtime_1.jsxs)("section", { className: 'nxcp-agent', "data-domain": domain, "data-status": step.status, "aria-label": label, children: [(0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-agent-head', children: [(0, jsx_runtime_1.jsx)(status_glyph_1.StatusGlyph, { glyph: (0, status_glyph_1.stepGlyph)(step.status), label: t(`copilot.step.status.${step.status}`), size: 11 }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-agent-name', children: label }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-agent-domain', children: t(`copilot.agent.domain.${domain}`) }), elapsed === undefined ? null : ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-agent-duration', children: (0, trace_labels_1.formatDuration)(elapsed) }))] }), step.task ? ((0, jsx_runtime_1.jsxs)("p", { className: 'nxcp-agent-task', children: [(0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-sr-only', children: [t('copilot.agent.task'), ": "] }), step.task] })) : null, step.feedback ? ((0, jsx_runtime_1.jsxs)("p", { className: 'nxcp-agent-feedback', children: [(0, jsx_runtime_1.jsx)("strong", { children: t('copilot.agent.refining') }), " \u00B7 ", step.feedback] })) : null, children] }));
}
