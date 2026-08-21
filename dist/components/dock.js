"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotDock = CopilotDock;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_dom_1 = require("react-dom");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const styles_1 = require("../ui/styles");
const theme_1 = require("../ui/theme");
const composer_1 = require("./composer");
const message_view_1 = require("./message-view");
const thread_list_1 = require("./thread-list");
const usage_footer_1 = require("./usage-footer");
const WIDTH_STORAGE_KEY = 'netix-copilot.width';
const OPEN_STORAGE_KEY = 'netix-copilot.open';
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 420;
const KEYBOARD_STEP = 24;
function readStored(key) {
    try {
        return window.localStorage.getItem(key);
    }
    catch {
        // Private windows and blocked site data throw on access rather than returning null.
        return null;
    }
}
function writeStored(key, value) {
    try {
        window.localStorage.setItem(key, value);
    }
    catch {
        // Persisting the dock size is a convenience, never a correctness requirement.
    }
}
function clampWidth(width, fallback = DEFAULT_WIDTH) {
    // A pointer event without a usable coordinate must not turn the width into NaN.
    if (!Number.isFinite(width))
        return fallback;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}
function CopilotDock({ headerActions, defaultOpen, showThreads = true, container, }) {
    const { t, theme } = (0, context_1.useCopilotAdapters)();
    const engine = (0, context_1.useCopilotEngine)();
    const state = (0, context_1.useCopilotState)();
    const enabled = (0, context_1.useCopilotEnabled)();
    const [open, setOpen] = (0, react_1.useState)(() => {
        const stored = readStored(OPEN_STORAGE_KEY);
        if (stored === 'true')
            return true;
        if (stored === 'false')
            return false;
        return defaultOpen ?? false;
    });
    const [width, setWidth] = (0, react_1.useState)(() => {
        const stored = Number(readStored(WIDTH_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH;
    });
    const bodyRef = (0, react_1.useRef)(null);
    const resizingRef = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => {
        (0, styles_1.injectCopilotStyles)();
    }, []);
    (0, react_1.useEffect)(() => {
        writeStored(OPEN_STORAGE_KEY, open ? 'true' : 'false');
    }, [open]);
    (0, react_1.useEffect)(() => {
        writeStored(WIDTH_STORAGE_KEY, String(width));
    }, [width]);
    const run = state.turns[state.turns.length - 1]?.run;
    const streaming = run !== undefined && (0, run_store_1.isRunActive)(run);
    const answerLength = run?.text.length ?? 0;
    // Follow the stream, but only while the reader is already near the bottom.
    (0, react_1.useEffect)(() => {
        const node = bodyRef.current;
        if (!node || !open)
            return;
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
        if (distance < 120)
            node.scrollTop = node.scrollHeight;
    }, [answerLength, state.turns.length, open]);
    const onResizePointerDown = (0, react_1.useCallback)((event) => {
        resizingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
    }, []);
    const onResizePointerMove = (0, react_1.useCallback)((event) => {
        if (!resizingRef.current)
            return;
        setWidth((current) => clampWidth(window.innerWidth - event.clientX, current));
    }, []);
    const onResizePointerUp = (0, react_1.useCallback)((event) => {
        resizingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }, []);
    if (!enabled)
        return null;
    const style = (0, theme_1.themeToCssVars)(theme);
    const target = container === undefined ? (typeof document === 'undefined' ? null : document.body) : container;
    const content = open ? ((0, jsx_runtime_1.jsxs)("aside", { className: 'nxcp-root nxcp-dock', style: { ...style, width }, role: 'complementary', "aria-label": t('copilot.dock.label'), "data-streaming": streaming ? 'true' : 'false', children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-resize', "aria-label": t('copilot.dock.resize'), onPointerDown: onResizePointerDown, onPointerMove: onResizePointerMove, onPointerUp: onResizePointerUp, onPointerCancel: onResizePointerUp, onKeyDown: (event) => {
                    if (event.key === 'ArrowLeft')
                        setWidth((current) => clampWidth(current + KEYBOARD_STEP));
                    if (event.key === 'ArrowRight')
                        setWidth((current) => clampWidth(current - KEYBOARD_STEP));
                } }), (0, jsx_runtime_1.jsxs)("header", { className: 'nxcp-header', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-title', children: t('copilot.dock.title') }), headerActions, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', onClick: () => engine.startNewThread(), disabled: streaming, children: t('copilot.dock.new') }), (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', onClick: () => setOpen(false), "aria-label": t('copilot.dock.close'), children: '×' })] }), !state.online ? (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-banner', children: t('copilot.status.offline') }) : null, showThreads ? (0, jsx_runtime_1.jsx)(thread_list_1.ThreadList, {}) : null, (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-body', ref: bodyRef, children: state.turns.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.dock.empty') })) : (state.turns.map((turn) => (0, jsx_runtime_1.jsx)(message_view_1.MessageView, { turn: turn }, turn.id))) }), (0, jsx_runtime_1.jsx)(composer_1.Composer, { autoFocus: true }), (0, jsx_runtime_1.jsx)(usage_footer_1.UsageFooter, { ...(run?.usage ? { usage: run.usage } : {}), ...(state.transport ? { transport: state.transport } : {}), ...(run?.model ? { model: run.model } : {}) })] })) : ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-root nxcp-launcher', style: style, onClick: () => setOpen(true), children: t('copilot.dock.open') }));
    if (!target)
        return null;
    return (0, react_dom_1.createPortal)(content, target);
}
