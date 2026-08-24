"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelTierSelector = ModelTierSelector;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const types_1 = require("../types");
function ModelTierSelector({ className }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const { tier, locked, setTier } = (0, context_1.useCopilotModelTier)();
    const move = (event) => {
        if (locked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
            return;
        event.preventDefault();
        const current = types_1.MODEL_TIERS.findIndex((entry) => entry.key === tier);
        const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const next = types_1.MODEL_TIERS[(current + delta + types_1.MODEL_TIERS.length) % types_1.MODEL_TIERS.length];
        if (next)
            setTier(next.key);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: `nxcp-tier-selector${className ? ` ${className}` : ''}`, role: 'radiogroup', "aria-label": t('copilot.tier.label'), "aria-disabled": locked, "data-locked": locked ? 'true' : 'false', onKeyDown: move, children: [types_1.MODEL_TIERS.map((entry) => ((0, jsx_runtime_1.jsxs)("label", { className: 'nxcp-tier-option', "data-selected": tier === entry.key, children: [(0, jsx_runtime_1.jsx)("input", { className: 'nxcp-tier-input', type: 'radio', name: 'nxcp-model-tier', value: entry.key, checked: tier === entry.key, disabled: locked, tabIndex: tier === entry.key ? 0 : -1, onChange: () => setTier(entry.key) }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-tier-name', children: entry.label.split(' ')[0] }), (0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-tier-badge', children: [entry.multiplier, "x"] })] }, entry.key))), locked ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-tier-lock', children: t('copilot.tier.locked') }) : null] }));
}
