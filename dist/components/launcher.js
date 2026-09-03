"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Launcher = Launcher;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const theme_1 = require("../ui/theme");
// The floating pill CopilotDock shows while minimised. The dock portals it into document.body
// alongside the card, so it shares the same z band and escapes any host stacking context.
function Launcher({ onOpen }) {
    const { t, theme } = (0, context_1.useCopilotAdapters)();
    const [expanded, setExpanded] = (0, react_1.useState)(false);
    return ((0, jsx_runtime_1.jsxs)("button", { type: 'button', className: 'nxcp-root nxcp-launcher', style: (0, theme_1.themeToCssVars)(theme), "aria-label": t('copilot.dock.open'), "data-expanded": expanded ? 'true' : 'false', onMouseEnter: () => setExpanded(true), onMouseLeave: () => setExpanded(false), onFocus: () => setExpanded(true), onBlur: () => setExpanded(false), onClick: () => {
            setExpanded(false);
            onOpen();
        }, children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-launcher-halo', "aria-hidden": 'true' }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-launcher-tile', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsxs)("svg", { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', children: [(0, jsx_runtime_1.jsx)("path", { d: 'M12 3.2 13.9 9l5.9 2-5.9 2L12 18.8 10.1 13 4.2 11l5.9-2z' }), (0, jsx_runtime_1.jsx)("path", { d: 'M18.4 3.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z' })] }) }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-launcher-label', children: t('copilot.dock.open') }), expanded ? ((0, jsx_runtime_1.jsx)("svg", { className: 'nxcp-launcher-chevron', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M5 12h14M13 6l6 6-6 6' }) })) : null] }));
}
