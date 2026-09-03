"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotPanel = CopilotPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const styles_1 = require("../ui/styles");
const theme_1 = require("../ui/theme");
const composer_1 = require("./composer");
const empty_state_1 = require("./empty-state");
const history_rail_1 = require("./history-rail");
const message_view_1 = require("./message-view");
const toast_pill_1 = require("./toast-pill");
const usage_footer_1 = require("./usage-footer");
function CopilotPanel({ title, headerActions, footerActions, emptyState, quickPrompts, showThreads = false, autoFocus, className, layout = 'dock', renderTurn, }) {
    const adapters = (0, context_1.useCopilotAdapters)();
    const { t, theme } = adapters;
    const engine = (0, context_1.useCopilotEngine)();
    const send = (0, context_1.useCopilotSend)();
    const state = (0, context_1.useCopilotState)();
    const bodyRef = (0, react_1.useRef)(null);
    const run = state.turns[state.turns.length - 1]?.run;
    const busy = state.sending || (run !== undefined && (0, run_store_1.isRunActive)(run));
    const chips = quickPrompts ?? adapters.quickPrompts ?? [];
    (0, react_1.useEffect)(() => (0, styles_1.injectCopilotStyles)(), []);
    (0, react_1.useEffect)(() => {
        const node = bodyRef.current;
        if (!node)
            return;
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
        if (distance < 140)
            node.scrollTop = node.scrollHeight;
    }, [run?.text.length, state.turns.length]);
    return ((0, jsx_runtime_1.jsxs)("section", { className: `nxcp-root nxcp-panel${className ? ` ${className}` : ''}`, style: (0, theme_1.themeToCssVars)(theme), "data-streaming": busy ? 'true' : 'false', "data-layout": layout, children: [(0, jsx_runtime_1.jsxs)("header", { className: 'nxcp-header', children: [(0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-title', children: [(0, jsx_runtime_1.jsx)(empty_state_1.SparkIcon, { size: 14 }), title ?? t('copilot.dock.title')] }), layout === 'full' ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-caption', children: t('copilot.dock.caption') })) : null, (0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-header-actions', children: [showThreads && layout === 'dock' ? (0, jsx_runtime_1.jsx)(history_rail_1.ThreadsPopover, {}) : null, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.dock.new'), title: t('copilot.dock.new'), onClick: () => engine.startNewThread(), disabled: busy, children: (0, jsx_runtime_1.jsx)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M12 5v14M5 12h14' }) }) }), headerActions] })] }), !state.online ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-banner', children: t('copilot.status.offline') }) : null, (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-body', ref: bodyRef, children: state.threadLoading ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.threads.restoring') })) : state.turns.length === 0 ? ((0, jsx_runtime_1.jsx)(empty_state_1.EmptyState, { heading: emptyState ?? t('copilot.dock.title'), body: t('copilot.dock.empty'), chips: chips, onSelect: send })) : (state.turns.map((turn) => {
                    const view = (0, jsx_runtime_1.jsx)(message_view_1.MessageView, { turn: turn }, turn.id);
                    return renderTurn ? (0, jsx_runtime_1.jsx)("div", { children: renderTurn(turn, view) }, turn.id) : view;
                })) }), (0, jsx_runtime_1.jsx)(composer_1.Composer, { autoFocus: autoFocus }), (0, jsx_runtime_1.jsx)(usage_footer_1.UsageFooter, { usage: run?.usage, transport: state.transport, modelTier: state.modelTier }), footerActions ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-footer-actions', children: footerActions }) : null, (0, jsx_runtime_1.jsx)(toast_pill_1.ToastHost, {})] }));
}
