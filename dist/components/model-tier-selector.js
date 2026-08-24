"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelTierSelector = ModelTierSelector;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const types_1 = require("../types");
function ModelTierSelector({ className }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const { tier, locked, setTier } = (0, context_1.useCopilotModelTier)();
    const changeTier = (event) => {
        setTier(event.target.value);
    };
    return ((0, jsx_runtime_1.jsxs)("label", { className: `nxcp-tier-selector${className ? ` ${className}` : ''}`, "data-locked": locked ? 'true' : 'false', title: locked ? t('copilot.tier.locked') : t('copilot.tier.label'), children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-tier-orb', "aria-hidden": 'true' }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-sr-only', children: t('copilot.tier.label') }), (0, jsx_runtime_1.jsx)("select", { className: 'nxcp-tier-select', "aria-label": t('copilot.tier.label'), value: tier, disabled: locked, onChange: changeTier, children: types_1.MODEL_TIERS.map((entry) => ((0, jsx_runtime_1.jsx)("option", { value: entry.key, children: entry.label }, entry.key))) }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-tier-chevron', "aria-hidden": 'true' })] }));
}
