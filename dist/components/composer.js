"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Composer = Composer;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const run_menu_1 = require("./run-menu");
const MAX_TEXTAREA_HEIGHT = 180;
// Anything that is its own control keeps its click; the rest of the card focuses the box.
const OWN_CLICK = 'button, select, a, input, textarea, label, [role="dialog"]';
// What the context chip names: the record on screen when there is one, else the host module.
function contextLabel(pageContext) {
    const { entity, state } = pageContext;
    if (entity)
        return entity.label ?? `${entity.type} ${entity.id}`;
    return typeof state?.module === 'string' ? state.module : undefined;
}
function Composer({ autoFocus, meta }) {
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
    if (state.threadReadOnly) {
        return (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', children: t('copilot.thread.readOnly') });
    }
    const submit = () => {
        if (!canSend)
            return;
        send(value);
        setValue('');
    };
    const onKeyDown = (event) => {
        // Enter sends, Shift+Enter breaks the line, matching the drawers this replaces.
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
        }
    };
    const stopping = run?.cancellation?.status === 'requested';
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-compose-shell', children: [state.turns.length === 0 ? (
            // Said once, before the first question; a conversation in progress needs no reminder.
            (0, jsx_runtime_1.jsxs)("p", { className: 'nxcp-disclaimer', children: [(0, jsx_runtime_1.jsxs)("svg", { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', "aria-hidden": 'true', children: [(0, jsx_runtime_1.jsx)("circle", { cx: 12, cy: 12, r: 9.5 }), (0, jsx_runtime_1.jsx)("path", { d: 'M12 11v5.5M12 7.6v.1' })] }), (0, jsx_runtime_1.jsx)("span", { children: t('copilot.composer.disclaimer') })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer', onMouseDown: (event) => {
                    // The whole card is the target: a press on its padding or the empty toolbar still lands
                    // in the box, with the caret at the end, and never steals focus from a real control.
                    if (event.target.closest(OWN_CLICK))
                        return;
                    event.preventDefault();
                    const box = boxRef.current;
                    if (!box)
                        return;
                    box.focus();
                    box.setSelectionRange(box.value.length, box.value.length);
                }, children: [(0, jsx_runtime_1.jsx)("textarea", { ref: boxRef, className: 'nxcp-textarea', value: value, rows: 1, autoFocus: autoFocus, placeholder: state.online ? t('copilot.composer.placeholder') : t('copilot.status.offline'), "aria-label": t('copilot.composer.label'), onChange: (event) => setValue(event.target.value), onKeyDown: onKeyDown }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer-toolbar', children: [label !== undefined ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-context-chip', "data-state": state.contextEnabled ? 'on' : 'off', "aria-pressed": state.contextEnabled, "aria-label": t('copilot.composer.context', { label }), title: state.contextEnabled
                                    ? t('copilot.composer.contextOn')
                                    : t('copilot.composer.contextOff'), onClick: () => engine.setContextEnabled(!state.contextEnabled), children: (0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-context-chip-label', dir: 'ltr', children: ["@", label] }) })) : null, (0, jsx_runtime_1.jsx)(run_menu_1.TierMenu, {}), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-composer-actions', children: [(0, jsx_runtime_1.jsx)(run_menu_1.UsageMeter, {}), busy ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-send', "data-busy": 'true', "aria-label": stopping ? t('copilot.composer.stopping') : t('copilot.composer.stop'), title: stopping ? t('copilot.composer.stopping') : t('copilot.composer.stop'), disabled: stopping, onClick: () => engine.cancel(), children: (0, jsx_runtime_1.jsx)("svg", { width: 10, height: 10, viewBox: '0 0 10 10', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("rect", { width: 10, height: 10, rx: 2, fill: 'currentColor' }) }) })) : ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-send', "aria-label": t('copilot.composer.send'), title: t('copilot.composer.send'), disabled: !canSend, onClick: submit, children: (0, jsx_runtime_1.jsx)("svg", { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M12 19V5M5 12l7-7 7 7' }) }) }))] })] })] }), meta ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-compose-foot', children: meta }) : null] }));
}
