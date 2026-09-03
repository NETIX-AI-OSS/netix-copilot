"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalCard = ApprovalCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
// Rendered for any step the backend parks in `awaiting_approval`. The decision goes back over
// the transport, which only the streaming contract implements; the poll transport rejects it
// loudly rather than pretending the approval was recorded.
function ApprovalCard({ step }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const engine = (0, context_1.useCopilotEngine)();
    const [pending, setPending] = (0, react_1.useState)(false);
    const [failure, setFailure] = (0, react_1.useState)(undefined);
    const decide = (approved) => {
        setPending(true);
        setFailure(undefined);
        engine
            .approve(step.id, approved)
            .catch((error) => {
            setFailure(error instanceof Error ? error.message : t('copilot.approval.failed'));
        })
            .finally(() => setPending(false));
    };
    return ((0, jsx_runtime_1.jsxs)("section", { className: 'nxcp-approval', "aria-label": t('copilot.approval.label'), children: [(0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-approval-head', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-approval-glyph', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsxs)("svg", { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false', children: [(0, jsx_runtime_1.jsx)("path", { d: 'M12 2l8 3v6c0 5.2-3.4 9.6-8 11-4.6-1.4-8-5.8-8-11V5l8-3z' }), (0, jsx_runtime_1.jsx)("path", { d: 'M9 12l2 2 4-4' })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-approval-body', children: [(0, jsx_runtime_1.jsx)("strong", { className: 'nxcp-approval-title', children: step.title }), step.argsSummary ? (0, jsx_runtime_1.jsx)("code", { className: 'nxcp-approval-args', children: step.argsSummary }) : null, step.detail ? (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-approval-detail', children: step.detail }) : null] })] }), failure ? ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-banner', "data-tone": 'error', children: failure })) : null, (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-approval-actions', children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-approval-button', "data-variant": 'approve', disabled: pending, onClick: () => decide(true), children: t('copilot.approval.approve') }), (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-approval-button', "data-variant": 'reject', disabled: pending, onClick: () => decide(false), children: t('copilot.approval.reject') })] })] }));
}
