"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotDock = CopilotDock;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_dom_1 = require("react-dom");
const context_1 = require("../adapters/context");
const styles_1 = require("../ui/styles");
const theme_1 = require("../ui/theme");
const launcher_1 = require("./launcher");
const panel_1 = require("./panel");
const WIDTH_STORAGE_KEY = 'netix-copilot.width';
const OPEN_STORAGE_KEY = 'netix-copilot.open';
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 430;
// How far the card floats from the viewport's inline-end edge (.nxcp-dock in styles.ts).
const DOCK_INSET = 22;
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
function CopilotDock({ open: openProp, onOpenChange, defaultOpen, showLauncher = true, container, mode: modeProp, onModeChange, headerActions, showThreads = true, ...panelProps }) {
    const { t, theme } = (0, context_1.useCopilotAdapters)();
    const enabled = (0, context_1.useCopilotEnabled)();
    const controlled = openProp !== undefined || modeProp !== undefined;
    const [localMode, setLocalMode] = (0, react_1.useState)(() => {
        const stored = readStored(OPEN_STORAGE_KEY);
        const open = stored === null ? (defaultOpen ?? false) : stored === 'true';
        return open ? 'dock' : 'min';
    });
    const mode = modeProp ?? (openProp === undefined ? localMode : openProp ? 'dock' : 'min');
    const setMode = (0, react_1.useCallback)((next) => {
        if (modeProp === undefined)
            setLocalMode(next);
        onModeChange?.(next);
        if ((next !== 'min') !== (mode !== 'min'))
            onOpenChange?.(next !== 'min');
    }, [modeProp, mode, onModeChange, onOpenChange]);
    const [width, setWidth] = (0, react_1.useState)(() => {
        const stored = Number(readStored(WIDTH_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH;
    });
    const resizing = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => (0, styles_1.injectCopilotStyles)(), []);
    (0, react_1.useEffect)(() => {
        if (!controlled)
            writeStored(OPEN_STORAGE_KEY, localMode === 'min' ? 'false' : 'true');
    }, [controlled, localMode]);
    (0, react_1.useEffect)(() => writeStored(WIDTH_STORAGE_KEY, String(width)), [width]);
    if (!enabled)
        return null;
    const target = container === undefined ? (typeof document === 'undefined' ? null : document.body) : container;
    if (!target || mode === 'full')
        return null;
    const content = mode === 'dock' ? ((0, jsx_runtime_1.jsxs)("aside", { className: 'nxcp-root nxcp-dock', style: { ...(0, theme_1.themeToCssVars)(theme), width }, role: 'complementary', "aria-label": t('copilot.dock.label'), children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-resize', "aria-label": t('copilot.dock.resize'), onPointerDown: (event) => {
                    resizing.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                }, onPointerMove: (event) => {
                    if (!resizing.current)
                        return;
                    // The handle sits on the inline-start edge, so which way "wider" points depends
                    // on the writing direction.
                    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
                    const edge = rtl ? event.clientX : window.innerWidth - event.clientX;
                    setWidth((current) => clampWidth(edge - DOCK_INSET, current));
                }, onPointerUp: (event) => {
                    resizing.current = false;
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId);
                }, onKeyDown: (event) => {
                    if (event.key === 'ArrowLeft')
                        setWidth((current) => clampWidth(current + 24));
                    if (event.key === 'ArrowRight')
                        setWidth((current) => clampWidth(current - 24));
                } }), (0, jsx_runtime_1.jsx)(panel_1.CopilotPanel, { ...panelProps, layout: 'dock', showThreads: showThreads, headerActions: (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [headerActions, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.dock.minimise'), title: t('copilot.dock.minimise'), onClick: () => setMode('min'), children: (0, jsx_runtime_1.jsx)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M5 12h14' }) }) }), onModeChange ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.dock.expand'), title: t('copilot.dock.expand'), onClick: () => setMode('full'), children: (0, jsx_runtime_1.jsx)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M8 3H3v5M3 3l7 7M16 21h5v-5M21 21l-7-7' }) }) })) : null, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.dock.close'), title: t('copilot.dock.close'), onClick: () => setMode('min'), children: (0, jsx_runtime_1.jsx)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M6 6l12 12M18 6L6 18' }) }) })] }) })] })) : showLauncher ? ((0, jsx_runtime_1.jsx)(launcher_1.Launcher, { onOpen: () => setMode('dock') })) : null;
    return (0, react_dom_1.createPortal)(content, target);
}
