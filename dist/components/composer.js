"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Composer = Composer;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const context_2 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const model_tier_selector_1 = require("./model-tier-selector");
function Composer({ autoFocus }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const send = (0, context_1.useCopilotSend)();
    const engine = (0, context_2.useCopilotEngine)();
    const state = (0, context_1.useCopilotState)();
    const [value, setValue] = (0, react_1.useState)('');
    const run = state.turns[state.turns.length - 1]?.run;
    const busy = state.sending || (run !== undefined && (0, run_store_1.isRunActive)(run));
    const canSend = value.trim() !== '' && !busy && state.online;
    const submit = () => {
        if (!canSend)
            return;
        send(value);
        setValue('');
    };
    const onKeyDown = (event) => {
        // Enter sends, Shift+Enter breaks the line, matching the drawers this replaces.
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-compose-shell', children: (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer', children: [(0, jsx_runtime_1.jsx)("textarea", { className: 'nxcp-textarea', value: value, rows: 1, autoFocus: autoFocus, placeholder: state.online ? t('copilot.composer.placeholder') : t('copilot.status.offline'), "aria-label": t('copilot.composer.label'), onChange: (event) => setValue(event.target.value), onKeyDown: onKeyDown }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer-toolbar', children: [(0, jsx_runtime_1.jsx)(model_tier_selector_1.ModelTierSelector, {}), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer-actions', children: [busy ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', onClick: () => engine.cancel(), children: t('copilot.composer.stop') })) : null, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-send', disabled: !canSend, onClick: submit, children: t('copilot.composer.send') })] })] })] }) }));
}
