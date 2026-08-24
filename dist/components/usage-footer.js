"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageFooter = UsageFooter;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const types_1 = require("../types");
// Every figure here is conditional, including the credit balance. ml-engine returns
// credits_remaining inside `usage` on both the SSE event and the REST payload, computed live from
// UserMLConfiguration and deliberately not persisted -- so it is present on a fresh answer and
// absent on a replayed one. Absent means unknown, which is why it hides rather than showing zero.
function UsageFooter({ usage, transport, modelTier }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const items = [];
    const hasUsage = usage?.tokensIn !== undefined ||
        usage?.tokensOut !== undefined ||
        usage?.calls !== undefined ||
        usage?.costUsd !== undefined ||
        usage?.creditsRemaining !== undefined;
    // The composer already exposes the active tier. Repeat it here only when it
    // gives context to real usage data, keeping an idle composer visually quiet.
    if (modelTier && hasUsage)
        items.push((0, types_1.modelTierMetadata)(modelTier).label);
    if (usage?.tokensIn !== undefined || usage?.tokensOut !== undefined) {
        items.push(t('copilot.usage.tokens', {
            in: usage.tokensIn ?? 0,
            out: usage.tokensOut ?? 0,
        }));
    }
    if (usage?.calls !== undefined)
        items.push(t('copilot.usage.calls', { count: usage.calls }));
    if (usage?.costUsd !== undefined)
        items.push(`$${usage.costUsd.toFixed(4)}`);
    if (usage?.creditsRemaining !== undefined) {
        items.push(t('copilot.usage.credits', { count: usage.creditsRemaining }));
    }
    if (items.length === 0 && transport === undefined)
        return null;
    return ((0, jsx_runtime_1.jsxs)("footer", { className: 'nxcp-footer', children: [items.map((item) => ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-usage-item', children: item }, item))), transport ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-usage-item', style: { marginLeft: 'auto' }, "data-transport": transport, children: t(`copilot.transport.${transport}`) })) : null] }));
}
