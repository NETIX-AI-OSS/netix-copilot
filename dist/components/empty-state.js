"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SparkIcon = SparkIcon;
exports.QuickPrompts = QuickPrompts;
exports.EmptyState = EmptyState;
const jsx_runtime_1 = require("react/jsx-runtime");
// The four-point spark the reference uses in place of a glyph character.
const SPARK_PATH = 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z';
function SparkIcon({ size }) {
    return ((0, jsx_runtime_1.jsx)("svg", { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: SPARK_PATH }) }));
}
function QuickPrompts({ chips, onSelect }) {
    if (chips.length === 0)
        return null;
    return ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-quick-prompts', children: chips.map((prompt) => ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-quick-prompt', onClick: () => onSelect(prompt), children: prompt }, prompt))) }));
}
function EmptyState({ heading, body, chips, onSelect }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-empty-state', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-empty-tile', children: (0, jsx_runtime_1.jsx)(SparkIcon, { size: 22 }) }), (0, jsx_runtime_1.jsx)("h3", { className: 'nxcp-empty-heading', children: heading }), (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty-body', children: body }), (0, jsx_runtime_1.jsx)(QuickPrompts, { chips: chips, onSelect: onSelect })] }));
}
