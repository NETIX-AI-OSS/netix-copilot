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
const message_view_1 = require("./message-view");
const thread_list_1 = require("./thread-list");
const usage_footer_1 = require("./usage-footer");
function CopilotPanel({ title, headerActions, footerActions, emptyState, quickPrompts = [], showThreads = false, autoFocus, className, renderTurn, }) {
    const { t, theme } = (0, context_1.useCopilotAdapters)();
    const engine = (0, context_1.useCopilotEngine)();
    const send = (0, context_1.useCopilotSend)();
    const state = (0, context_1.useCopilotState)();
    const bodyRef = (0, react_1.useRef)(null);
    const run = state.turns[state.turns.length - 1]?.run;
    const busy = state.sending || (run !== undefined && (0, run_store_1.isRunActive)(run));
    (0, react_1.useEffect)(() => (0, styles_1.injectCopilotStyles)(), []);
    (0, react_1.useEffect)(() => {
        const node = bodyRef.current;
        if (!node)
            return;
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
        if (distance < 140)
            node.scrollTop = node.scrollHeight;
    }, [run?.text.length, state.turns.length]);
    return ((0, jsx_runtime_1.jsxs)("section", { className: `nxcp-root nxcp-panel${className ? ` ${className}` : ''}`, style: (0, theme_1.themeToCssVars)(theme), "data-streaming": busy ? 'true' : 'false', children: [(0, jsx_runtime_1.jsxs)("header", { className: 'nxcp-header', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-title', children: title ?? t('copilot.dock.title') }), headerActions, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', onClick: () => engine.startNewThread(), disabled: busy, children: t('copilot.dock.new') })] }), !state.online ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-banner', children: t('copilot.status.offline') }) : null, showThreads ? (0, jsx_runtime_1.jsx)(thread_list_1.ThreadList, {}) : null, (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-body', ref: bodyRef, children: state.threadLoading ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.threads.restoring') })) : state.turns.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-empty-state', children: [emptyState ?? (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.dock.empty') }), quickPrompts.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-quick-prompts', children: quickPrompts.map((prompt) => ((0, jsx_runtime_1.jsx)("button", { type: 'button', onClick: () => send(prompt), children: prompt }, prompt))) })) : null] })) : (state.turns.map((turn) => {
                    const view = (0, jsx_runtime_1.jsx)(message_view_1.MessageView, { turn: turn }, turn.id);
                    return renderTurn ? (0, jsx_runtime_1.jsx)("div", { children: renderTurn(turn, view) }, turn.id) : view;
                })) }), (0, jsx_runtime_1.jsx)(composer_1.Composer, { autoFocus: autoFocus }), (0, jsx_runtime_1.jsx)(usage_footer_1.UsageFooter, { usage: run?.usage, transport: state.transport, modelTier: state.modelTier }), footerActions ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-footer-actions', children: footerActions }) : null] }));
}
