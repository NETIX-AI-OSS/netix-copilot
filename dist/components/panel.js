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
        if (distance < 160)
            node.scrollTop = node.scrollHeight;
    }, [run?.text.length, run?.steps.length, run?.status, state.turns.length]);
    return ((0, jsx_runtime_1.jsxs)("section", { className: `nxcp-root nxcp-panel${className ? ` ${className}` : ''}`, style: (0, theme_1.themeToCssVars)(theme), "data-streaming": busy ? 'true' : 'false', "data-layout": layout, children: [(0, jsx_runtime_1.jsxs)("header", { className: 'nxcp-header', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-title', children: (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-title-text', children: title ?? t('copilot.dock.title') }) }), layout === 'full' ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-caption', children: t('copilot.dock.caption') })) : null, (0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-header-actions', children: [showThreads && layout !== 'full' ? (0, jsx_runtime_1.jsx)(history_rail_1.ThreadsPopover, {}) : null, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button nxcp-header-new', "aria-label": t('copilot.dock.new'), title: t('copilot.dock.new'), onClick: () => engine.startNewThread(), disabled: busy || state.turns.length === 0, children: (0, jsx_runtime_1.jsxs)("svg", { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', "aria-hidden": 'true', children: [(0, jsx_runtime_1.jsx)("path", { d: 'M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6' }), (0, jsx_runtime_1.jsx)("path", { d: 'M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z' })] }) }), headerActions] })] }), !state.online ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-banner', children: t('copilot.status.offline') }) : null, (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-body', ref: bodyRef, children: (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-body-inner', children: state.threadLoading ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.threads.restoring') })) : state.turns.length === 0 ? (emptyState === undefined ? ((0, jsx_runtime_1.jsx)(empty_state_1.EmptyState, { heading: t('copilot.dock.title'), body: t('copilot.dock.empty'), chips: chips, onSelect: send })) : (
                    // A host placeholder stands in for the whole default block, as it did in v0.3.
                    (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-empty-state', children: [emptyState, (0, jsx_runtime_1.jsx)(empty_state_1.QuickPrompts, { chips: chips, onSelect: send })] }))) : (state.turns.map((turn) => {
                        const view = (0, jsx_runtime_1.jsx)(message_view_1.MessageView, { turn: turn }, turn.id);
                        return renderTurn ? (0, jsx_runtime_1.jsx)("div", { children: renderTurn(turn, view) }, turn.id) : view;
                    })) }) }), (0, jsx_runtime_1.jsx)(composer_1.Composer, { autoFocus: autoFocus, meta: footerActions ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-footer-actions', children: footerActions }) : null }), (0, jsx_runtime_1.jsx)(toast_pill_1.ToastHost, {})] }));
}
