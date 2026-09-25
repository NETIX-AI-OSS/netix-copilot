"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TierMenu = TierMenu;
exports.UsageMeter = UsageMeter;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const types_1 = require("../types");
// The composer's two small popovers: the response tier, and the usage meter. Both open above
// their trigger and close on a choice, on Escape and on a press outside.
function usePopover() {
    const [open, setOpen] = (0, react_1.useState)(false);
    const root = (0, react_1.useRef)(null);
    const trigger = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        const onPointerDown = (event) => {
            if (!root.current?.contains(event.target))
                setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key !== 'Escape')
                return;
            // Escape closes this popover only; the sheet around it must not also close.
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            trigger.current?.focus();
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [open]);
    return { open, setOpen, root, trigger };
}
function Check() {
    return ((0, jsx_runtime_1.jsx)("svg", { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M5 12l5 5L20 7' }) }));
}
// A plain dropdown: the tier on a pill, the three tiers in the popover. Nothing else lives here.
function TierMenu() {
    const { t } = (0, context_1.useCopilotAdapters)();
    const { tier, locked, setTier } = (0, context_1.useCopilotModelTier)();
    const { open, setOpen, root, trigger } = usePopover();
    const menuId = (0, react_1.useId)();
    const tierLabel = t(`copilot.tier.${tier}`);
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-popover-root', ref: root, children: [(0, jsx_runtime_1.jsxs)("button", { ref: trigger, type: 'button', className: 'nxcp-tier-selector', "data-locked": locked ? 'true' : 'false', "aria-label": `${t('copilot.tier.label')}: ${tierLabel}`, title: locked ? t('copilot.tier.locked') : undefined, "aria-haspopup": 'dialog', "aria-expanded": open, "aria-controls": open ? menuId : undefined, onClick: () => setOpen((current) => !current), children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-tier-value', children: tierLabel }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-tier-chevron', "aria-hidden": 'true' })] }), open ? ((0, jsx_runtime_1.jsxs)("div", { id: menuId, className: 'nxcp-popover nxcp-tier-menu', role: 'dialog', "aria-label": t('copilot.tier.label'), children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-popover-label', id: `${menuId}-label`, children: t('copilot.tier.label') }), (0, jsx_runtime_1.jsx)("div", { role: 'radiogroup', "aria-labelledby": `${menuId}-label`, className: 'nxcp-tier-options', children: types_1.MODEL_TIERS.map((entry) => ((0, jsx_runtime_1.jsxs)("button", { type: 'button', role: 'radio', "aria-checked": entry.key === tier, className: 'nxcp-tier-option', disabled: locked, onClick: () => {
                                setTier(entry.key);
                                setOpen(false);
                                trigger.current?.focus();
                            }, children: [(0, jsx_runtime_1.jsx)("span", { children: t(`copilot.tier.${entry.key}`) }), entry.key === tier ? (0, jsx_runtime_1.jsx)(Check, {}) : null] }, entry.key))) }), locked ? (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-popover-note', children: t('copilot.tier.locked') }) : null] })) : null] }));
}
const RING_RADIUS = 7;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
function compact(value, locale) {
    try {
        return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }
    catch {
        return String(value);
    }
}
// The small ring beside Send, as coding agents show it: it fills with the share of the model's
// context window the last reply used, and opens the usage figures. It only fills against a window
// the backend reported, and it is absent until there is something real to show.
function UsageMeter() {
    const { t, locale } = (0, context_1.useCopilotAdapters)();
    const state = (0, context_1.useCopilotState)();
    const { open, setOpen, root, trigger } = usePopover();
    const panelId = (0, react_1.useId)();
    const run = state.turns[state.turns.length - 1]?.run;
    const usage = run?.usage;
    const hasUsage = usage !== undefined &&
        (usage.tokensIn !== undefined ||
            usage.tokensOut !== undefined ||
            usage.calls !== undefined ||
            usage.costUsd !== undefined ||
            usage.creditsRemaining !== undefined);
    // A fresh conversation has nothing to measure, even if an earlier one left a transport behind.
    if (run === undefined || (!hasUsage && state.transport === undefined))
        return null;
    const contextWindow = usage?.contextWindow;
    const used = usage?.tokensIn;
    const share = contextWindow !== undefined && used !== undefined
        ? Math.min(1, Math.max(0, used / contextWindow))
        : undefined;
    const percent = share === undefined ? undefined : Math.round(share * 100);
    const label = percent === undefined
        ? t('copilot.usage.open')
        : `${t('copilot.usage.open')}: ${t('copilot.usage.context')} ${percent}%`;
    const rows = [];
    if (usage?.tokensIn !== undefined) {
        rows.push({
            key: 'in',
            label: t('copilot.usage.input'),
            value: compact(usage.tokensIn, locale),
        });
    }
    if (usage?.tokensOut !== undefined) {
        rows.push({
            key: 'out',
            label: t('copilot.usage.output'),
            value: compact(usage.tokensOut, locale),
        });
    }
    if (usage?.calls !== undefined) {
        rows.push({ key: 'calls', label: t('copilot.usage.callsLabel'), value: String(usage.calls) });
    }
    if (usage?.costUsd !== undefined) {
        rows.push({
            key: 'cost',
            label: t('copilot.usage.cost'),
            value: `$${usage.costUsd.toFixed(4)}`,
        });
    }
    if (usage?.creditsRemaining !== undefined) {
        rows.push({
            key: 'credits',
            label: t('copilot.usage.creditsLeft'),
            value: compact(usage.creditsRemaining, locale),
        });
    }
    if (usage?.model !== undefined) {
        rows.push({ key: 'model', label: t('copilot.usage.model'), value: usage.model });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-popover-root', ref: root, children: [(0, jsx_runtime_1.jsx)("button", { ref: trigger, type: 'button', className: 'nxcp-usage-meter', "aria-label": label, title: label, "aria-haspopup": 'dialog', "aria-expanded": open, "aria-controls": open ? panelId : undefined, "data-level": share === undefined ? 'unknown' : share >= 0.9 ? 'high' : share >= 0.7 ? 'mid' : 'low', onClick: () => setOpen((current) => !current), children: share === undefined ? (
                // No context window reported: a plain usage glyph, never a ring that looks like progress.
                (0, jsx_runtime_1.jsx)("svg", { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M5 20V11M12 20V4M19 20v-6' }) })) : ((0, jsx_runtime_1.jsxs)("svg", { width: 18, height: 18, viewBox: '0 0 18 18', "aria-hidden": 'true', children: [(0, jsx_runtime_1.jsx)("circle", { className: 'nxcp-usage-track', cx: 9, cy: 9, r: RING_RADIUS }), (0, jsx_runtime_1.jsx)("circle", { className: 'nxcp-usage-fill', cx: 9, cy: 9, r: RING_RADIUS, strokeDasharray: RING_LENGTH, strokeDashoffset: RING_LENGTH * (1 - share) })] })) }), open ? ((0, jsx_runtime_1.jsxs)("div", { id: panelId, className: 'nxcp-popover nxcp-usage-panel', role: 'dialog', "aria-label": t('copilot.usage.open'), children: [share === undefined || contextWindow === undefined || used === undefined ? null : (
                    // Only when the backend reports the window; otherwise there is no share to show.
                    (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-usage-context', children: [(0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-usage-context-head', children: [(0, jsx_runtime_1.jsx)("span", { children: t('copilot.usage.context') }), (0, jsx_runtime_1.jsxs)("strong", { children: [percent, "%"] })] }), (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-usage-bar', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("span", { style: { width: `${share * 100}%` } }) }), (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-popover-note', children: t('copilot.usage.contextOf', {
                                    used: compact(used, locale),
                                    total: compact(contextWindow, locale),
                                }) })] })), rows.length > 0 ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-popover-label', children: t('copilot.usage.title') }), (0, jsx_runtime_1.jsx)("dl", { className: 'nxcp-usage-rows', children: rows.map((row) => ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-usage-row', children: [(0, jsx_runtime_1.jsx)("dt", { children: row.label }), (0, jsx_runtime_1.jsx)("dd", { children: row.value })] }, row.key))) })] })) : null, state.transport ? ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-usage-row nxcp-usage-connection', children: [(0, jsx_runtime_1.jsx)("span", { children: t('copilot.usage.connection') }), (0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-usage-connection-value', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-transport-dot', "data-transport": state.transport, role: 'img', "aria-label": t(`copilot.transport.${state.transport}`) }), t(`copilot.transport.${state.transport}`)] })] })) : null] })) : null] }));
}
