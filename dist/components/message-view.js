"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageView = MessageView;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const answer_actions_1 = require("./answer-actions");
const answer_blocks_1 = require("./answer-blocks");
const approval_card_1 = require("./approval-card");
const artifact_card_1 = require("./artifact-card");
const markdown_1 = require("./markdown");
const reasoning_trace_1 = require("./reasoning-trace");
const result_table_1 = require("./result-table");
// One prompt and everything the run produced for it: any status chips, the reasoning
// trace, the streaming answer, the artifacts, any approval the backend is waiting on and the
// answer strip.
//
// `turn.prompt` is rendered, never `turn.wirePrompt`: whatever the host appended for the backend
// stays off the screen.
function MessageView({ turn, showBadges = true, showResultData = true, }) {
    const { t, renderChart, renderMarkdown } = (0, context_1.useCopilotAdapters)();
    const { threadReadOnly } = (0, context_1.useCopilotState)();
    const { run } = turn;
    const streaming = (0, run_store_1.isRunActive)(run);
    const approvals = threadReadOnly
        ? []
        : run.steps.filter((step) => step.status === 'awaiting_approval');
    const table = showResultData && run.resultData && (0, result_table_1.hasResultContent)(run.resultData);
    // Only what a reader needs to know about the run: a non-default tier or how it ended. Who
    // answered and when needs no header row; the time sits in the answer strip.
    const chips = [];
    if (run.modelTier !== undefined && run.modelTier !== 'base') {
        chips.push({ key: 'tier', tone: 'tier', label: t(`copilot.tier.${run.modelTier}`) });
    }
    if (run.status === 'error') {
        chips.push({ key: 'error', tone: 'warning', label: t('copilot.status.failed') });
    }
    if (run.status === 'cancelled') {
        chips.push({ key: 'cancelled', tone: 'warning', label: t('copilot.status.cancelled') });
    }
    return ((0, jsx_runtime_1.jsxs)("article", { className: 'nxcp-turn', children: [(0, jsx_runtime_1.jsx)("p", { className: 'nxcp-bubble', children: turn.prompt }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-assistant', children: [chips.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-assistant-meta', children: chips.map((chip) => ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-assistant-chip', "data-tone": chip.tone, children: chip.label }, chip.key))) })) : null, (0, jsx_runtime_1.jsx)(reasoning_trace_1.ReasoningTrace, { run: run, defaultOpen: streaming }), run.text !== '' ? ((0, jsx_runtime_1.jsx)(answer_blocks_1.AnswerBlocks, { children: renderMarkdown ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [renderMarkdown(run.text, { streaming }), streaming ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-caret', "aria-hidden": 'true' }) : null] })) : ((0, jsx_runtime_1.jsx)(markdown_1.Markdown, { text: run.text, streaming: streaming })) })) : null, run.charts.map((chart) => ((0, jsx_runtime_1.jsx)(artifact_card_1.ArtifactCard, { title: chart.title ?? t('copilot.artifact.chart'), children: (0, jsx_runtime_1.jsx)("figure", { className: 'nxcp-chart', children: renderChart(chart, { height: 280, streaming }) }) }, chart.id))), table && run.resultData ? ((0, jsx_runtime_1.jsx)(artifact_card_1.ArtifactCard, { title: t('copilot.artifact.table'), children: (0, jsx_runtime_1.jsx)(result_table_1.ResultTable, { data: run.resultData }) })) : null, approvals.map((step) => ((0, jsx_runtime_1.jsx)(approval_card_1.ApprovalCard, { step: step }, step.id))), run.status === 'paused' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', children: t('copilot.status.offline') })) : null, run.cancellation?.status === 'requested' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', children: t('copilot.status.cancelling') })) : null, run.cancellation?.status === 'failed' ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', "data-tone": 'error', role: 'alert', children: run.cancellation.message ?? t('copilot.status.cancelFailed') })) : null, run.error ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-banner', "data-tone": 'error', role: 'alert', children: run.error.message })) : null, (0, run_store_1.isRunFinished)(run) ? (0, jsx_runtime_1.jsx)(answer_actions_1.AnswerActions, { turn: turn, showCaption: showBadges }) : null] })] }));
}
