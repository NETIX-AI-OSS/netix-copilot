"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReasoningTrace = ReasoningTrace;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const trace_model_1 = require("../runtime/trace-model");
const agent_card_1 = require("./agent-card");
const status_glyph_1 = require("./status-glyph");
const step_row_1 = require("./step-row");
const trace_labels_1 = require("./trace-labels");
const use_now_1 = require("./use-now");
const AUTO_COLLAPSE_MS = 600;
const LIVE_REGION_MS = 1000;
// The run's own wall-clock figure when it reported one, else the span the step timestamps
// cover, else what the live counter last saw. Never invented.
function runElapsedMs(run, nowMs) {
    if (run.executionMs !== undefined)
        return run.executionMs;
    if (run.startedAt === undefined)
        return undefined;
    const finished = run.steps.reduce((latest, step) => step.finishedAt !== undefined && (latest === undefined || step.finishedAt > latest)
        ? step.finishedAt
        : latest, undefined);
    const end = (0, run_store_1.isRunFinished)(run) ? (finished ?? nowMs) : nowMs;
    return end === undefined ? undefined : Math.max(0, end - run.startedAt);
}
function describeRun(run, tree, t, labels, nowMs) {
    const total = (0, trace_model_1.countSteps)(tree);
    const settled = run.steps.filter((step) => step.status !== 'pending').length;
    const agents = (0, trace_model_1.agentSteps)(run.steps).length;
    const awaiting = run.steps.some((step) => step.status === 'awaiting_approval');
    if (awaiting && !(0, run_store_1.isRunFinished)(run)) {
        return { glyph: 'shield', label: t('copilot.trace.awaiting') };
    }
    switch (run.status) {
        case 'creating':
        case 'queued':
            return {
                glyph: 'dots',
                label: run.status === 'queued' && run.queuePosition !== undefined
                    ? t('copilot.status.queuedAt', { position: run.queuePosition })
                    : t('copilot.trace.thinking'),
            };
        case 'streaming':
        case 'paused': {
            if (total === 0) {
                return run.hasPlan
                    ? { glyph: 'ring', label: t('copilot.trace.planning') }
                    : { glyph: 'dots', label: t('copilot.trace.thinking') };
            }
            if (run.hasPlan || agents > 0) {
                return { glyph: 'ring', label: t('copilot.trace.stepOf', { k: settled, n: total }) };
            }
            return {
                glyph: 'ring',
                label: run.agent === undefined ? t('copilot.trace.working') : (0, trace_labels_1.agentLabel)(t, labels, run.agent),
            };
        }
        case 'error':
            return { glyph: 'cross', label: t('copilot.trace.stopped', { steps: total }) };
        case 'cancelled':
            return { glyph: 'stop', label: t('copilot.trace.stopped', { steps: total }) };
        default: {
            const ms = runElapsedMs(run, nowMs);
            if (ms === undefined) {
                return { glyph: 'tick', label: t('copilot.trace.summarySteps', { steps: total }) };
            }
            const seconds = (ms / 1000).toFixed(1);
            return {
                glyph: 'tick',
                label: agents > 0
                    ? t('copilot.trace.summaryAgents', { seconds, steps: total, agents })
                    : t('copilot.trace.summary', { seconds, steps: total }),
            };
        }
    }
}
// Recursion lives here so the cards and rows never import each other.
function TraceNodes({ nodes, nowMs }) {
    return ((0, jsx_runtime_1.jsx)("ol", { className: 'nxcp-trace-nodes', children: nodes.map((node) => {
            const nested = node.children.length === 0 ? null : (0, jsx_runtime_1.jsx)(TraceNodes, { nodes: node.children, nowMs: nowMs });
            if ((0, trace_model_1.isAgentStep)(node.step)) {
                return ((0, jsx_runtime_1.jsx)("li", { className: 'nxcp-trace-node', "data-kind": 'agent', children: (0, jsx_runtime_1.jsx)(agent_card_1.AgentCard, { step: node.step, nowMs: nowMs, children: nested }) }, node.step.id));
            }
            return ((0, jsx_runtime_1.jsx)(step_row_1.StepRow, { step: node.step, nowMs: nowMs, children: nested }, node.step.id));
        }) }));
}
function ReasoningTrace({ run, defaultOpen, now }) {
    const { t, labels } = (0, context_1.useCopilotAdapters)();
    const bodyId = (0, react_1.useId)();
    const [initialOpen] = (0, react_1.useState)(defaultOpen ?? false);
    const [userOpen, setUserOpen] = (0, react_1.useState)(undefined);
    const [autoCollapsed, setAutoCollapsed] = (0, react_1.useState)(false);
    const active = (0, run_store_1.isRunActive)(run) || run.status === 'paused';
    const nowMs = (0, use_now_1.useNow)(active, now);
    const tree = (0, trace_model_1.buildTraceTree)(run.steps);
    const header = describeRun(run, tree, t, labels, nowMs);
    const liveLabel = (0, use_now_1.useSettled)(header.label, LIVE_REGION_MS);
    (0, react_1.useEffect)(() => {
        if (run.status !== 'done')
            return undefined;
        const handle = setTimeout(() => setAutoCollapsed(true), AUTO_COLLAPSE_MS);
        return () => clearTimeout(handle);
    }, [run.status]);
    if (tree.length === 0 && run.plan === undefined && !active)
        return null;
    const awaiting = !(0, run_store_1.isRunFinished)(run) && run.steps.some((step) => step.status === 'awaiting_approval');
    const open = userOpen ?? (awaiting || (initialOpen && !autoCollapsed));
    const elapsed = active && run.startedAt !== undefined && nowMs !== undefined
        ? (0, trace_labels_1.formatDuration)(Math.max(0, nowMs - run.startedAt))
        : undefined;
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-trace', "data-status": run.status, children: [(0, jsx_runtime_1.jsxs)("button", { type: 'button', className: 'nxcp-trace-toggle', "aria-expanded": open, "aria-controls": bodyId, onClick: () => setUserOpen(!open), children: [(0, jsx_runtime_1.jsx)(status_glyph_1.StatusGlyph, { glyph: header.glyph, label: t(`copilot.run.status.${run.status}`) }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-trace-label', children: header.label }), run.rebuilt ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-trace-chip', children: t('copilot.trace.rebuilt') }) : null, elapsed === undefined ? null : (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-trace-elapsed', children: elapsed }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-chevron', "aria-hidden": 'true' })] }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-sr-only', "aria-live": 'polite', children: liveLabel }), (0, jsx_runtime_1.jsxs)("div", { id: bodyId, className: 'nxcp-trace-body', role: 'group', "aria-label": t('copilot.trace.label'), hidden: !open, children: [run.plan ? ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-trace-plan', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-trace-plan-label', children: t('copilot.plan.label') }), run.plan.reasoning ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-trace-plan-reasoning', children: run.plan.reasoning })) : null, run.plan.lines.length === 0 ? null : ((0, jsx_runtime_1.jsx)("ol", { className: 'nxcp-trace-plan-lines', children: run.plan.lines.map((line, index) => ((0, jsx_runtime_1.jsx)("li", { children: line }, index))) }))] })) : null, tree.length === 0 ? null : (0, jsx_runtime_1.jsx)(TraceNodes, { nodes: tree, nowMs: nowMs })] })] }));
}
