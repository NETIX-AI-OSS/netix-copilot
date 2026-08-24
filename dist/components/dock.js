"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotDock = CopilotDock;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_dom_1 = require("react-dom");
const context_1 = require("../adapters/context");
const styles_1 = require("../ui/styles");
const theme_1 = require("../ui/theme");
const panel_1 = require("./panel");
const WIDTH_STORAGE_KEY = 'netix-copilot.width';
const OPEN_STORAGE_KEY = 'netix-copilot.open';
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 420;
function readStored(key) {
    try {
        return window.localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
function writeStored(key, value) {
    try {
        window.localStorage.setItem(key, value);
    }
    catch {
        // Persistence is optional.
    }
}
function clampWidth(width, fallback = DEFAULT_WIDTH) {
    if (!Number.isFinite(width))
        return fallback;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}
function CopilotDock({ open: openProp, onOpenChange, defaultOpen, showLauncher = true, container, headerActions, showThreads = true, ...panelProps }) {
    const { t, theme } = (0, context_1.useCopilotAdapters)();
    const enabled = (0, context_1.useCopilotEnabled)();
    const controlled = openProp !== undefined;
    const [localOpen, setLocalOpen] = (0, react_1.useState)(() => {
        const stored = readStored(OPEN_STORAGE_KEY);
        return stored === null ? (defaultOpen ?? false) : stored === 'true';
    });
    const open = controlled ? openProp : localOpen;
    const setOpen = (0, react_1.useCallback)((next) => {
        if (!controlled)
            setLocalOpen(next);
        onOpenChange?.(next);
    }, [controlled, onOpenChange]);
    const [width, setWidth] = (0, react_1.useState)(() => {
        const stored = Number(readStored(WIDTH_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH;
    });
    const resizing = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => (0, styles_1.injectCopilotStyles)(), []);
    (0, react_1.useEffect)(() => {
        if (!controlled)
            writeStored(OPEN_STORAGE_KEY, localOpen ? 'true' : 'false');
    }, [controlled, localOpen]);
    (0, react_1.useEffect)(() => writeStored(WIDTH_STORAGE_KEY, String(width)), [width]);
    if (!enabled)
        return null;
    const target = container === undefined ? (typeof document === 'undefined' ? null : document.body) : container;
    if (!target)
        return null;
    const content = open ? ((0, jsx_runtime_1.jsxs)("aside", { className: 'nxcp-root nxcp-dock', style: { ...(0, theme_1.themeToCssVars)(theme), width }, role: 'complementary', "aria-label": t('copilot.dock.label'), children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-resize', "aria-label": t('copilot.dock.resize'), onPointerDown: (event) => {
                    resizing.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                }, onPointerMove: (event) => {
                    if (resizing.current)
                        setWidth((current) => clampWidth(window.innerWidth - event.clientX, current));
                }, onPointerUp: (event) => {
                    resizing.current = false;
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId);
                }, onKeyDown: (event) => {
                    if (event.key === 'ArrowLeft')
                        setWidth((current) => clampWidth(current + 24));
                    if (event.key === 'ArrowRight')
                        setWidth((current) => clampWidth(current - 24));
                } }), (0, jsx_runtime_1.jsx)(panel_1.CopilotPanel, { ...panelProps, showThreads: showThreads, headerActions: (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [headerActions, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', onClick: () => setOpen(false), "aria-label": t('copilot.dock.close'), children: "\u00D7" })] }) })] })) : showLauncher ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-root nxcp-launcher', style: (0, theme_1.themeToCssVars)(theme), onClick: () => setOpen(true), children: t('copilot.dock.open') })) : null;
    return (0, react_dom_1.createPortal)(content, target);
}
