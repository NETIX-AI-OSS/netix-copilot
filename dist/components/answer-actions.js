"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groundingCounts = groundingCounts;
exports.AnswerActions = AnswerActions;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const run_store_1 = require("../runtime/run-store");
const trace_model_1 = require("../runtime/trace-model");
const notify_1 = require("./notify");
// The clipboard API is absent on plain-http hosts and inside some embedded webviews, where the
// selection command still works.
function legacyCopy(text) {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    try {
        return document.execCommand('copy');
    }
    catch {
        return false;
    }
    finally {
        box.remove();
    }
}
async function copyText(text) {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard?.writeText) {
        try {
            await clipboard.writeText(text);
            return true;
        }
        catch {
            // Permission denied or no user gesture: the selection command may still work.
        }
    }
    return legacyCopy(text);
}
// The `done` payload names the tools ml-engine reports; a rebuilt or truncated summary may not
// carry them, so the steps that ran are the next best count.
function groundingCounts(run) {
    const reported = (run.tools ?? []).length;
    const tools = reported > 0 ? reported : run.steps.filter((step) => !(0, trace_model_1.isAgentStep)(step)).length;
    return { tools, agents: (0, trace_model_1.agentSteps)(run.steps).length };
}
// The strip under a finished answer: copy, regenerate and the grounding caption. Regenerate only
// belongs to the newest turn -- an earlier one would re-ask a question the thread has moved past.
function AnswerActions({ turn, showCaption = true }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const state = (0, context_1.useCopilotState)();
    const notify = (0, notify_1.useNotify)();
    const regenerate = (0, context_1.useCopilotRegenerate)();
    const { run } = turn;
    const newest = state.turns[state.turns.length - 1];
    const busy = state.sending || (newest !== undefined && (0, run_store_1.isRunActive)(newest.run));
    const canRegenerate = newest?.id === turn.id;
    const caption = showCaption && run.status === 'done' && run.executionMs !== undefined;
    const copy = () => {
        void copyText(run.text).then((copied) => {
            notify(copied
                ? { message: t('copilot.answer.copied') }
                : { message: t('copilot.answer.copyUnavailable'), tone: 'error' });
        });
    };
    if (run.text === '' && !canRegenerate && !caption)
        return null;
    const { tools, agents } = groundingCounts(run);
    const seconds = ((run.executionMs ?? 0) / 1000).toFixed(1);
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-actions', children: [run.text !== '' ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-actions-button', title: t('copilot.answer.copy'), "aria-label": t('copilot.answer.copy'), onClick: copy, children: (0, jsx_runtime_1.jsxs)("svg", { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.2', "aria-hidden": 'true', focusable: 'false', children: [(0, jsx_runtime_1.jsx)("rect", { x: '9', y: '9', width: '12', height: '12', rx: '2' }), (0, jsx_runtime_1.jsx)("path", { d: 'M5 15V5a2 2 0 0 1 2-2h10' })] }) })) : null, canRegenerate ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-actions-button', title: t('copilot.answer.regenerate'), "aria-label": t('copilot.answer.regenerate'), disabled: busy, onClick: () => regenerate(turn.id), children: (0, jsx_runtime_1.jsx)("svg", { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.2', "aria-hidden": 'true', focusable: 'false', children: (0, jsx_runtime_1.jsx)("path", { d: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6' }) }) })) : null, caption ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-actions-caption', children: agents > 0
                    ? t('copilot.answer.groundingAgents', { tools, agents, seconds })
                    : t('copilot.answer.grounding', { tools, seconds }) })) : null] }));
}
