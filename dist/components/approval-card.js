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
    return ((0, jsx_runtime_1.jsxs)("section", { className: 'nxcp-approval', "aria-label": t('copilot.approval.label'), children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: step.title }), step.argsSummary ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-step-args', children: step.argsSummary }) : null] }), failure ? ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-banner', "data-tone": 'error', children: failure })) : null, (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-approval-actions', children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-send', disabled: pending, onClick: () => decide(true), children: t('copilot.approval.approve') }), (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', disabled: pending, onClick: () => decide(false), children: t('copilot.approval.reject') })] })] }));
}
