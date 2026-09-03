"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stepGlyph = stepGlyph;
exports.StatusGlyph = StatusGlyph;
const jsx_runtime_1 = require("react/jsx-runtime");
const STEP_GLYPHS = {
    pending: 'clock',
    running: 'ring',
    ok: 'tick',
    error: 'cross',
    skipped: 'dash',
    awaiting_approval: 'shield',
    rejected: 'cross',
    cancelled: 'stop',
};
function stepGlyph(status) {
    return STEP_GLYPHS[status];
}
const ICON_PATHS = {
    tick: 'M4 12l5 5L20 6',
    cross: 'M6 6l12 12M18 6L6 18',
    shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 3',
    dash: 'M5 12h14',
};
// One picture per status, drawn from CSS or an inline path so no icon set is bundled. The
// picture is hidden from assistive technology and the label carries its meaning instead.
function StatusGlyph({ glyph, label, size = 12 }) {
    const path = ICON_PATHS[glyph];
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-glyph', "data-glyph": glyph, "aria-hidden": 'true', style: glyph === 'dots' ? undefined : { width: size, height: size }, children: [glyph === 'dots' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-glyph-dot' }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-glyph-dot' }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-glyph-dot' })] })) : null, glyph === 'stop' ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-glyph-stop' }) : null, path ? ((0, jsx_runtime_1.jsx)("svg", { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', children: (0, jsx_runtime_1.jsx)("path", { d: path, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' }) })) : null] }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-sr-only', children: label })] }));
}
