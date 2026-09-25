"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotDock = CopilotDock;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_dom_1 = require("react-dom");
const context_1 = require("../adapters/context");
const url_1 = require("../adapters/url");
const styles_1 = require("../ui/styles");
const theme_1 = require("../ui/theme");
const history_rail_1 = require("./history-rail");
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
function CopilotDock({ open: openProp, onOpenChange, defaultOpen, showLauncher = true, container, mode: modeProp, onModeChange, urlState, headerActions, showThreads = true, ...panelProps }) {
    const { t, theme } = (0, context_1.useCopilotAdapters)();
    const engine = (0, context_1.useCopilotEngine)();
    const { threadId } = (0, context_1.useCopilotState)();
    const enabled = (0, context_1.useCopilotEnabled)();
    // The URL is the source of the open state when a host passes it, so storage is not consulted.
    const controlled = openProp !== undefined || modeProp !== undefined || urlState !== undefined;
    const [localMode, setLocalMode] = (0, react_1.useState)(() => {
        if (urlState !== undefined)
            return 'min';
        const stored = readStored(OPEN_STORAGE_KEY);
        const open = stored === null ? (defaultOpen ?? false) : stored === 'true';
        return open ? 'dock' : 'min';
    });
    const urlOpen = urlState !== undefined && (0, url_1.isUrlOpen)(urlState);
    const urlThread = urlState === undefined ? undefined : (0, url_1.readUrlThread)(urlState);
    let mode;
    if (modeProp !== undefined)
        mode = modeProp;
    // `open` says open or closed; whether an open dock is expanded stays the dock's own state.
    else if (openProp !== undefined)
        mode = !openProp ? 'min' : localMode === 'expanded' ? 'expanded' : 'dock';
    else if (urlOpen && localMode === 'min')
        mode = 'dock';
    else
        mode = localMode;
    const setMode = (0, react_1.useCallback)((next) => {
        if (modeProp === undefined)
            setLocalMode(next);
        const nextOpen = next !== 'min';
        if (urlState !== undefined && nextOpen !== urlOpen) {
            urlState.set(nextOpen
                ? { [url_1.COPILOT_URL_PARAMS.open]: '1' }
                : { [url_1.COPILOT_URL_PARAMS.open]: null, [url_1.COPILOT_URL_PARAMS.thread]: null });
        }
        onModeChange?.(next);
        if (nextOpen !== (mode !== 'min'))
            onOpenChange?.(nextOpen);
    }, [modeProp, mode, onModeChange, onOpenChange, urlOpen, urlState]);
    // A `?thread=` link restores that conversation once the dock is open; closing drops the link, so
    // a later link to the same thread restores it again. The thread already open is never
    // re-selected, which would abort a live run.
    const restoredThread = (0, react_1.useRef)(undefined);
    (0, react_1.useEffect)(() => {
        if (urlThread === undefined) {
            restoredThread.current = undefined;
            return;
        }
        if (mode === 'min' || restoredThread.current === urlThread)
            return;
        restoredThread.current = urlThread;
        if (threadId !== urlThread)
            engine.selectThread(urlThread);
    }, [engine, mode, threadId, urlThread]);
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
    (0, react_1.useEffect)(() => engine.recordDockMode(enabled ? mode : 'min'), [enabled, engine, mode]);
    if (!enabled)
        return null;
    const target = container === undefined ? (typeof document === 'undefined' ? null : document.body) : container;
    if (!target || mode === 'full')
        return null;
    const controls = ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [headerActions, mode === 'expanded' ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.dock.collapse'), title: t('copilot.dock.collapse'), onClick: () => setMode('dock'), children: (0, jsx_runtime_1.jsx)(Icon, { path: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7' }) })) : ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.dock.expand'), title: t('copilot.dock.expand'), onClick: () => setMode('expanded'), children: (0, jsx_runtime_1.jsx)(Icon, { path: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7' }) })), (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.dock.close'), title: t('copilot.dock.close'), onClick: () => setMode('min'), children: (0, jsx_runtime_1.jsx)(Icon, { path: 'M6 6l12 12M18 6L6 18' }) })] }));
    let content = null;
    if (mode === 'expanded') {
        content = ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-root nxcp-expanded-layer', style: (0, theme_1.themeToCssVars)(theme), children: [(0, jsx_runtime_1.jsx)("div", { className: 'nxcp-backdrop', "aria-hidden": 'true', onClick: () => setMode('dock') }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-expanded', role: 'dialog', "aria-modal": 'true', "aria-label": t('copilot.dock.label'), onKeyDown: (event) => {
                        if (event.key === 'Escape' && !event.defaultPrevented)
                            setMode('dock');
                    }, children: [(0, jsx_runtime_1.jsx)("aside", { className: 'nxcp-expanded-rail', "aria-label": t('copilot.threads.label'), children: (0, jsx_runtime_1.jsx)(history_rail_1.HistoryRail, {}) }), (0, jsx_runtime_1.jsx)(panel_1.CopilotPanel, { ...panelProps, layout: 'expanded', autoFocus: true, 
                            // The rail sits beside the panel; the popover only shows where the rail cannot fit.
                            showThreads: showThreads, headerActions: controls })] })] }));
    }
    else if (mode === 'dock') {
        content = ((0, jsx_runtime_1.jsxs)("aside", { className: 'nxcp-root nxcp-dock', style: { ...(0, theme_1.themeToCssVars)(theme), width }, role: 'complementary', "aria-label": t('copilot.dock.label'), children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-resize', "aria-label": t('copilot.dock.resize'), onPointerDown: (event) => {
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
                    } }), (0, jsx_runtime_1.jsx)(panel_1.CopilotPanel, { ...panelProps, layout: 'dock', showThreads: showThreads, headerActions: controls })] }));
    }
    else if (showLauncher) {
        content = (0, jsx_runtime_1.jsx)(launcher_1.Launcher, { onOpen: () => setMode('dock') });
    }
    return (0, react_dom_1.createPortal)(content, target);
}
function Icon({ path }) {
    return ((0, jsx_runtime_1.jsx)("svg", { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: path }) }));
}
