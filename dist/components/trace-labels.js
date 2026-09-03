"use strict";
// Human labels for the raw ml-engine names the trace renders. Precedence is the host's own
// label map, then the translation catalogue, then a readable form of the raw name, so a tool
// the catalogue has never heard of still reads as words rather than an identifier.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolLabel = toolLabel;
exports.agentLabel = agentLabel;
exports.agentDomain = agentDomain;
exports.formatDuration = formatDuration;
const trace_model_1 = require("../runtime/trace-model");
const i18n_1 = require("../ui/i18n");
const CAFM_AGENTS = new Set(['work_orders', 'commercial', 'compliance', 'complaints']);
// A host's t() returns the key itself for anything it has no translation for, which is the only
// signal available that the catalogue lacks the entry.
function translated(t, key) {
    if (key in i18n_1.COPILOT_STRINGS)
        return t(key);
    const value = t(key);
    return value === key ? undefined : value;
}
function sentenceCase(name) {
    const words = name.replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
function titleCase(name) {
    return name
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
function toolLabel(t, labels, tool, status) {
    const base = labels?.tools?.[tool] ?? translated(t, `copilot.tool.${tool}`) ?? sentenceCase(tool);
    if (status === 'awaiting_approval' || status === 'rejected') {
        return `${base} · ${t('copilot.tool.needsApproval')}`;
    }
    return base;
}
function agentLabel(t, labels, nameOrTool) {
    const key = (0, trace_model_1.agentKey)(nameOrTool) ?? nameOrTool;
    return (labels?.agents?.[nameOrTool] ??
        labels?.agents?.[key] ??
        translated(t, `copilot.agent.${key}`) ??
        titleCase(key.replace(/^call_/, '').replace(/_agent$/, '')));
}
function agentDomain(key) {
    return CAFM_AGENTS.has((0, trace_model_1.agentKey)(key) ?? key) ? 'cafm' : 'netix';
}
// Durations as the reference draws them: milliseconds under a second, one decimal above.
function formatDuration(ms) {
    if (ms < 1000)
        return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}
