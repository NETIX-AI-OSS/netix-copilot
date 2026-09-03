"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageView = MessageView;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const answer_actions_1 = require("./answer-actions");
const approval_card_1 = require("./approval-card");
const artifact_card_1 = require("./artifact-card");
const markdown_1 = require("./markdown");
const reasoning_trace_1 = require("./reasoning-trace");
const result_table_1 = require("./result-table");
// The house sparkle, the same path the assistant header uses.
const SPARK = 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z';
function formatTime(epochMs) {
    return new Date(epochMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
// One prompt and everything the run produced for it: the assistant meta row, the reasoning
// trace, the streaming answer, the artifacts, any approval the backend is waiting on and the
// answer strip.
//
// `turn.prompt` is rendered, never `turn.wirePrompt`: whatever the host appended for the backend
// stays off the screen.
function MessageView({ turn, showBadges = true, showResultData = true, }) {
    const { t, renderChart, renderMarkdown } = (0, context_1.useCopilotAdapters)();
    const { run } = turn;
    const streaming = (0, run_store_1.isRunActive)(run);
    const approvals = run.steps.filter((step) => step.status === 'awaiting_approval');
    const table = showResultData && run.resultData && (0, result_table_1.hasResultContent)(run.resultData);
    return ((0, jsx_runtime_1.jsxs)("article", { className: 'nxcp-turn', children: [(0, jsx_runtime_1.jsx)("p", { className: 'nxcp-bubble', children: turn.prompt }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-assistant', children: [(0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-assistant-meta', children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-avatar', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("svg", { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'currentColor', focusable: 'false', children: (0, jsx_runtime_1.jsx)("path", { d: SPARK }) }) }), (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-assistant-name', children: t('copilot.dock.title') }), run.modelTier !== undefined && run.modelTier !== 'base' ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-assistant-chip', "data-tone": 'tier', children: t(`copilot.tier.${run.modelTier}`) })) : null, (0, jsx_runtime_1.jsx)("time", { className: 'nxcp-assistant-time', dateTime: new Date(turn.createdAt).toISOString(), children: formatTime(turn.createdAt) }), run.status === 'error' ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-assistant-chip', "data-tone": 'warning', children: t('copilot.status.failed') })) : null, run.status === 'cancelled' ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-assistant-chip', "data-tone": 'warning', children: t('copilot.status.cancelled') })) : null] }), (0, jsx_runtime_1.jsx)(reasoning_trace_1.ReasoningTrace, { run: run, defaultOpen: streaming }), run.text !== '' ? ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-answer', children: [renderMarkdown ? (renderMarkdown(run.text, { streaming })) : ((0, jsx_runtime_1.jsx)(markdown_1.Markdown, { text: run.text })), streaming ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-caret', "aria-hidden": 'true' }) : null] })) : null, run.charts.map((chart) => ((0, jsx_runtime_1.jsx)(artifact_card_1.ArtifactCard, { title: chart.title ?? t('copilot.artifact.chart'), children: (0, jsx_runtime_1.jsx)("figure", { className: 'nxcp-chart', children: renderChart(chart, { height: 280, streaming }) }) }, chart.id))), table && run.resultData ? ((0, jsx_runtime_1.jsx)(artifact_card_1.ArtifactCard, { title: t('copilot.artifact.table'), children: (0, jsx_runtime_1.jsx)(result_table_1.ResultTable, { data: run.resultData }) })) : null, approvals.map((step) => ((0, jsx_runtime_1.jsx)(approval_card_1.ApprovalCard, { step: step }, step.id))), run.status === 'paused' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', children: t('copilot.status.offline') })) : null, run.error ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', "data-tone": 'error', role: 'alert', children: run.error.message })) : null, (0, run_store_1.isRunFinished)(run) ? (0, jsx_runtime_1.jsx)(answer_actions_1.AnswerActions, { turn: turn, showCaption: showBadges }) : null] })] }));
}
