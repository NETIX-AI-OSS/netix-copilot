"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageView = MessageView;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const approval_card_1 = require("./approval-card");
const markdown_1 = require("./markdown");
const plan_timeline_1 = require("./plan-timeline");
const result_table_1 = require("./result-table");
const run_badges_1 = require("./run-badges");
// One prompt and everything the run produced for it: the status badges, the step timeline, the
// streaming answer, any charts, the result table and any approval the backend is waiting on.
//
// `turn.prompt` is rendered, never `turn.wirePrompt`: whatever the host appended for the backend
// stays off the screen.
function MessageView({ turn, showBadges = true, showResultData = true, }) {
    const { t, renderChart, renderMarkdown } = (0, context_1.useCopilotAdapters)();
    const { run } = turn;
    const streaming = (0, run_store_1.isRunActive)(run);
    const approvals = run.steps.filter((step) => step.status === 'awaiting_approval');
    return ((0, jsx_runtime_1.jsxs)("article", { className: 'nxcp-turn', children: [(0, jsx_runtime_1.jsx)("p", { className: 'nxcp-bubble', children: turn.prompt }), run.status === 'queued' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: run.queuePosition === undefined
                    ? t('copilot.status.queued')
                    : t('copilot.status.queuedAt', { position: run.queuePosition }) })) : null, showBadges ? (0, jsx_runtime_1.jsx)(run_badges_1.RunBadges, { run: run }) : null, (0, jsx_runtime_1.jsx)(plan_timeline_1.PlanTimeline, { steps: run.steps, hasPlan: run.hasPlan }), run.text !== '' ? ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-answer', children: [renderMarkdown ? renderMarkdown(run.text, { streaming }) : (0, jsx_runtime_1.jsx)(markdown_1.Markdown, { text: run.text }), streaming ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-caret', "aria-hidden": 'true' }) : null] })) : null, showResultData && run.resultData ? (0, jsx_runtime_1.jsx)(result_table_1.ResultTable, { data: run.resultData }) : null, run.charts.map((chart) => ((0, jsx_runtime_1.jsxs)("figure", { className: 'nxcp-chart', style: { margin: 0 }, children: [chart.title ? (0, jsx_runtime_1.jsx)("figcaption", { className: 'nxcp-chart-title', children: chart.title }) : null, renderChart(chart, { height: 280, streaming })] }, chart.id))), approvals.map((step) => ((0, jsx_runtime_1.jsx)(approval_card_1.ApprovalCard, { step: step }, step.id))), run.status === 'paused' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', children: t('copilot.status.offline') })) : null, run.error ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', "data-tone": 'error', role: 'alert', children: run.error.message })) : null, run.status === 'cancelled' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.status.cancelled') })) : null, streaming && run.text === '' && run.steps.length === 0 && run.status !== 'queued' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.status.thinking') })) : null] }));
}
