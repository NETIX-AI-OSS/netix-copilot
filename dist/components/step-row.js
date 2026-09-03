"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepRow = StepRow;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const trace_model_1 = require("../runtime/trace-model");
const status_glyph_1 = require("./status-glyph");
const trace_labels_1 = require("./trace-labels");
const RAW_OUTPUT_CAP = 4000;
function rawText(output) {
    const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    return text.length > RAW_OUTPUT_CAP ? `${text.slice(0, RAW_OUTPUT_CAP)}…` : text;
}
// One tool call. The head is a button only when there is something to expand, so a row with no
// detail is plain text rather than a control that does nothing.
function StepRow({ step, nowMs, children }) {
    const { t, labels } = (0, context_1.useCopilotAdapters)();
    const [open, setOpen] = (0, react_1.useState)(false);
    const [raw, setRaw] = (0, react_1.useState)(false);
    const detailId = (0, react_1.useId)();
    const expandable = step.detail !== undefined || step.output !== undefined;
    const label = step.tool === undefined ? step.title : (0, trace_labels_1.toolLabel)(t, labels, step.tool, step.status);
    const elapsed = (0, trace_model_1.stepElapsedMs)(step, nowMs);
    const expiresIn = step.status === 'awaiting_approval' && step.expiresAt !== undefined && nowMs !== undefined
        ? Math.max(0, Math.ceil((step.expiresAt - nowMs) / 1000))
        : undefined;
    const head = ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(status_glyph_1.StatusGlyph, { glyph: (0, status_glyph_1.stepGlyph)(step.status), label: t(`copilot.step.status.${step.status}`), size: 11 }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-row-label', children: label }), step.argsSummary ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-row-args', children: step.argsSummary }) : null, expiresIn === undefined ? null : ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-row-expires', children: t('copilot.trace.expiresIn', { seconds: expiresIn }) })), elapsed === undefined ? null : ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-row-duration', children: (0, trace_labels_1.formatDuration)(elapsed) })), expandable ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-chevron', "aria-hidden": 'true' }) : null] }));
    return ((0, jsx_runtime_1.jsxs)("li", { className: 'nxcp-trace-node nxcp-row', "data-kind": 'tool', "data-status": step.status, children: [expandable ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-row-head', "aria-expanded": open, "aria-controls": detailId, onClick: () => setOpen((current) => !current), children: head })) : ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-row-head', children: head })), expandable ? ((0, jsx_runtime_1.jsxs)("div", { id: detailId, className: 'nxcp-row-detail', hidden: !open, children: [step.detail ? (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-row-detail-text', children: step.detail }) : null, step.output === undefined ? null : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-row-raw-toggle', "aria-pressed": raw, onClick: () => setRaw((current) => !current), children: t(raw ? 'copilot.trace.hideRaw' : 'copilot.trace.showRaw') }), raw ? (0, jsx_runtime_1.jsx)("pre", { className: 'nxcp-row-raw', children: rawText(step.output) }) : null] }))] })) : null, children] }));
}
