"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Composer = Composer;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const model_tier_selector_1 = require("./model-tier-selector");
const MAX_TEXTAREA_HEIGHT = 120;
// What the context chip names: the record on screen when there is one, else the host module.
function contextLabel(pageContext) {
    const { entity, state } = pageContext;
    if (entity)
        return entity.label ?? `${entity.type} ${entity.id}`;
    return typeof state?.module === 'string' ? state.module : undefined;
}
function Composer({ autoFocus }) {
    const { t, pageContext } = (0, context_1.useCopilotAdapters)();
    const send = (0, context_1.useCopilotSend)();
    const engine = (0, context_1.useCopilotEngine)();
    const state = (0, context_1.useCopilotState)();
    const [value, setValue] = (0, react_1.useState)('');
    const boxRef = (0, react_1.useRef)(null);
    const run = state.turns[state.turns.length - 1]?.run;
    const busy = state.sending || (run !== undefined && (0, run_store_1.isRunActive)(run));
    const canSend = value.trim() !== '' && !busy && state.online;
    const label = contextLabel(pageContext);
    // Grows with the draft up to a ceiling; the stylesheet's min-height keeps an empty box open.
    (0, react_1.useEffect)(() => {
        const box = boxRef.current;
        if (!box)
            return;
        box.style.height = 'auto';
        box.style.height = `${Math.min(box.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    }, [value]);
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-compose-shell', children: [(0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer', children: [label !== undefined ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-context-chip', "data-state": state.contextEnabled ? 'on' : 'off', "aria-pressed": state.contextEnabled, "aria-label": t('copilot.composer.context', { label }), title: state.contextEnabled
                            ? t('copilot.composer.contextOn')
                            : t('copilot.composer.contextOff'), onClick: () => engine.setContextEnabled(!state.contextEnabled), children: (0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-context-chip-label', dir: 'ltr', children: ["@", label] }) })) : null, (0, jsx_runtime_1.jsx)("textarea", { ref: boxRef, className: 'nxcp-textarea', value: value, rows: 1, autoFocus: autoFocus, placeholder: state.online ? t('copilot.composer.placeholder') : t('copilot.status.offline'), "aria-label": t('copilot.composer.label'), onChange: (event) => setValue(event.target.value), onKeyDown: onKeyDown }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer-toolbar', children: [(0, jsx_runtime_1.jsx)(model_tier_selector_1.ModelTierSelector, {}), (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-composer-actions', children: busy ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-send', "data-busy": 'true', onClick: () => engine.cancel(), children: t('copilot.composer.stop') })) : ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-send', disabled: !canSend, onClick: submit, children: t('copilot.composer.send') })) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer-meta', children: [(0, jsx_runtime_1.jsx)("span", { children: t('copilot.composer.disclaimer') }), (0, jsx_runtime_1.jsx)("span", { children: t('copilot.composer.hint') })] })] }));
}
