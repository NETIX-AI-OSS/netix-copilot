"use strict";
// Rebuilding a stored run into the shape a live run ends in.
//
// ml-engine stores the same run twice under two names: AgenticMLRequest, where one row is a whole
// thread, and ConversationTurn, where one row is a single turn. The columns are the same either
// way, so the reconstruction lives here once and each transport supplies its own row grouping.
//
// The point of doing this at all is that adopting the SDK must not lose history. A replayed turn
// carries its plan, its tool calls, its chart, its result table and its timing, so it renders
// through exactly the same components as the turn that just finished streaming.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENTIC_STATUS = void 0;
exports.summarizeArguments = summarizeArguments;
exports.readStepId = readStepId;
exports.readStepTitle = readStepTitle;
exports.planSteps = planSteps;
exports.logStep = logStep;
exports.logSteps = logSteps;
exports.readPlanOutput = readPlanOutput;
exports.rebuildRun = rebuildRun;
exports.mergeSteps = mergeSteps;
exports.readRunSummary = readRunSummary;
exports.mapUsage = mapUsage;
exports.runStatusFrom = runStatusFrom;
exports.emptyRun = emptyRun;
exports.parseMessages = parseMessages;
exports.timestampOf = timestampOf;
exports.runFromRow = runFromRow;
exports.transcriptFromRequest = transcriptFromRequest;
exports.turnFromRow = turnFromRow;
const trace_model_1 = require("../runtime/trace-model");
const result_data_1 = require("./result-data");
// service/models.py StatusChoices.
exports.AGENTIC_STATUS = {
    PENDING: 0,
    COMPLETED: 1,
    ERRORED: 2,
    PROCESSING: 3,
    CANCELLED: 4,
};
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// execution_log entries are { tool, call_id, iteration, arguments, output } with `arguments` as a
// real object on REST and as a truncated string on the stream, so both have to flatten to a line.
function summarizeArguments(value) {
    if (typeof value === 'string')
        return value === '' ? undefined : value;
    if (!isRecord(value))
        return undefined;
    const parts = [];
    for (const [key, entry] of Object.entries(value)) {
        if (entry === null || entry === undefined)
            continue;
        const rendered = typeof entry === 'object'
            ? Array.isArray(entry)
                ? `[${entry.length}]`
                : '{…}'
            : String(entry);
        parts.push(`${key}=${rendered}`);
        if (parts.length === 4)
            break;
    }
    if (parts.length === 0)
        return undefined;
    const summary = parts.join(', ');
    return summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
}
function readStepId(entry, index) {
    const callId = entry.call_id ?? entry.callId;
    if (typeof callId === 'string' && callId !== '')
        return callId;
    return `step-${index}`;
}
function readStepTitle(entry, index) {
    if (typeof entry.tool === 'string' && entry.tool !== '')
        return entry.tool;
    if (typeof entry.detail === 'string' && entry.detail !== '')
        return entry.detail;
    return `Step ${index + 1}`;
}
// The stored `plan` column is ml-engine's plan_trace, whose entries carry in_progress, completed,
// errored or rejected. Collapsing everything that is not 'completed' to pending would render a
// failed step as one still waiting to run.
const PLAN_STATUSES = {
    in_progress: 'running',
    completed: 'ok',
    errored: 'error',
    rejected: 'rejected',
    awaiting_approval: 'awaiting_approval',
    cancelled: 'cancelled',
    skipped: 'skipped',
};
function planStatus(value) {
    return typeof value === 'string' ? (PLAN_STATUSES[value] ?? 'pending') : 'pending';
}
function readNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
// The lineage and timing a newer ml-engine persists on plan_trace and sub_execution_log entries.
function lineageOf(entry) {
    const parentId = entry.parent_call_id ?? entry.parentCallId;
    const depth = readNumber(entry.depth);
    const startedAt = readNumber(entry.started_at ?? entry.startedAt);
    const finishedAt = readNumber(entry.finished_at ?? entry.finishedAt);
    const durationMs = readNumber(entry.duration_ms ?? entry.durationMs);
    return {
        ...(typeof entry.agent === 'string' ? { agent: entry.agent } : {}),
        ...(typeof parentId === 'string' && parentId !== '' ? { parentId } : {}),
        ...(depth === undefined ? {} : { depth }),
        ...(startedAt === undefined ? {} : { startedAt }),
        ...(finishedAt === undefined ? {} : { finishedAt }),
        ...(durationMs === undefined ? {} : { durationMs }),
    };
}
// A `call_*_agent` entry is a specialist delegation: its arguments carry the orchestrator's task,
// and the stored output names the specialist class that ran it.
function withKind(step, entry) {
    if (!(0, trace_model_1.isAgentStep)(step))
        return { ...step, kind: 'tool' };
    const args = isRecord(entry.arguments) ? entry.arguments : {};
    const output = isRecord(entry.output) ? entry.output : {};
    const task = typeof args.task === 'string' && args.task !== '' ? args.task : undefined;
    const feedback = typeof args.feedback === 'string' && args.feedback !== '' ? args.feedback : undefined;
    return {
        ...step,
        kind: 'agent',
        title: task ?? step.title,
        ...(typeof output.specialist === 'string' ? { agent: output.specialist } : {}),
        ...(task === undefined ? {} : { task }),
        ...(feedback === undefined ? {} : { feedback }),
    };
}
function planSteps(plan) {
    return plan
        .filter(isRecord)
        .filter((entry) => entry.tool !== trace_model_1.PLAN_TOOL)
        .map((entry, index) => {
        const summary = summarizeArguments(entry.arguments);
        return withKind({
            id: readStepId(entry, index),
            title: readStepTitle(entry, index),
            status: planStatus(entry.status),
            ...(typeof entry.tool === 'string' ? { tool: entry.tool } : {}),
            ...(summary === undefined ? {} : { argsSummary: summary }),
            ...(typeof entry.detail === 'string' ? { detail: entry.detail } : {}),
            ...lineageOf(entry),
        }, entry);
    });
}
// How base.py sets a trace status: a stored status when there is one, otherwise a result carrying
// `error` failed unless its approval_status says how. Keeping to that rule is what lets the log
// entry and its plan_trace twin agree when they merge.
function outputStatus(entry) {
    if (typeof entry.status === 'string') {
        const known = PLAN_STATUSES[entry.status];
        if (known !== undefined)
            return known;
        if (entry.status === 'ok')
            return 'ok';
        if (entry.status === 'error')
            return 'error';
    }
    const output = isRecord(entry.output) ? entry.output : undefined;
    if (output === undefined || output.error === undefined)
        return 'ok';
    const approval = typeof output.approval_status === 'string' ? PLAN_STATUSES[output.approval_status] : undefined;
    return approval ?? 'error';
}
function logStep(entry, index) {
    const summary = summarizeArguments(entry.arguments);
    return withKind({
        id: readStepId(entry, index),
        title: readStepTitle(entry, index),
        status: outputStatus(entry),
        ...(typeof entry.tool === 'string' ? { tool: entry.tool } : {}),
        ...(summary === undefined ? {} : { argsSummary: summary }),
        ...lineageOf(entry),
        ...(entry.output === undefined ? {} : { output: entry.output }),
    }, entry);
}
// A specialist's own tool calls, stored under the meta-tool's output. Their call_ids are the ones
// the live step events carried, so a flat live trace re-parents rather than duplicates; an older
// backend that stored none gets ids derived from the parent instead.
function childSteps(parent, entry) {
    const output = isRecord(entry.output) ? entry.output : {};
    const log = Array.isArray(output.sub_execution_log) ? output.sub_execution_log : [];
    const agent = typeof output.specialist === 'string' ? output.specialist : parent.agent;
    return log.filter(isRecord).map((child, index) => {
        const callId = child.call_id ?? child.callId;
        const summary = summarizeArguments(child.arguments);
        return {
            id: typeof callId === 'string' && callId !== '' ? callId : `${parent.id}-${index}`,
            title: readStepTitle(child, index),
            status: outputStatus(child),
            kind: 'tool',
            ...(typeof child.tool === 'string' ? { tool: child.tool } : {}),
            ...(summary === undefined ? {} : { argsSummary: summary }),
            ...(typeof child.detail === 'string' ? { detail: child.detail } : {}),
            ...lineageOf(child),
            ...(agent === undefined ? {} : { agent }),
            parentId: parent.id,
            depth: (parent.depth ?? 0) + 1,
            ...(child.output === undefined ? {} : { output: child.output }),
        };
    });
}
// One execution_log entry as the steps it describes: the call itself, then the specialist's
// calls beneath it. Every path that reads a stored row nests through this one function.
function logSteps(entry, index) {
    const step = logStep(entry, index);
    return step.kind === 'agent' ? [step, ...childSteps(step, entry)] : [step];
}
// The plan the model wrote, from the make_plan entry's stored output.
function readPlanOutput(entry) {
    if (entry.tool !== trace_model_1.PLAN_TOOL)
        return undefined;
    const output = isRecord(entry.output) ? entry.output : {};
    const lines = Array.isArray(output.steps)
        ? output.steps.filter((line) => typeof line === 'string')
        : [];
    const reasoning = typeof output.reasoning === 'string' ? output.reasoning : undefined;
    return { ...(reasoning === undefined ? {} : { reasoning }), lines };
}
// ml-engine marks a direct-routed run by inserting a synthetic call_*_agent entry into plan_trace
// under a `direct-<domain>-<pk>` call_id. It never streams and execution_log has no twin, so it
// names the specialist for the header instead of drawing an empty card.
const DIRECT_MARKER = /^direct-/;
// The trace tree from a stored row: plan_trace and execution_log describe the same calls under
// the same call_id, the make_plan entry yields the plan, and each call_*_agent entry brings its
// specialist's calls in beneath it. Plan lines are shown as written, never as pending steps.
function rebuildRun(row) {
    const stored = Array.isArray(row.plan) ? row.plan : [];
    const lines = stored.filter((line) => typeof line === 'string');
    let plan = lines.length > 0 ? { lines } : undefined;
    const traced = planSteps(stored);
    const marker = traced.find((step) => step.kind === 'agent' && DIRECT_MARKER.test(step.id));
    const steps = traced.filter((step) => step !== marker);
    const log = (Array.isArray(row.execution_log) ? row.execution_log : []).filter(isRecord);
    for (let index = 0; index < log.length; index += 1) {
        const entry = log[index];
        const planned = readPlanOutput(entry);
        if (planned !== undefined)
            plan = planned;
        else
            steps.push(...logSteps(entry, index));
    }
    return {
        steps: mergeSteps(steps),
        ...(plan === undefined ? {} : { plan }),
        ...(marker === undefined
            ? {}
            : { route: 'direct', agent: (0, trace_model_1.agentKey)(marker.title) ?? marker.title }),
    };
}
// plan_trace and execution_log describe the same tool calls under the same call_id, so a
// transcript that concatenated them would render every step twice.
function mergeSteps(steps) {
    const merged = [];
    for (const step of steps) {
        const index = merged.findIndex((entry) => entry.id === step.id);
        if (index === -1)
            merged.push(step);
        else
            merged[index] = { ...merged[index], ...step };
    }
    return merged;
}
// ml-engine's result_data field only populates for Responses-API shaped messages and is null for
// every run the current agent loop produces, so the newest tool output is the real source.
function lastToolOutput(row) {
    const log = Array.isArray(row.execution_log) ? row.execution_log : [];
    for (let index = log.length - 1; index >= 0; index -= 1) {
        const entry = log[index];
        if (!isRecord(entry))
            continue;
        const table = (0, result_data_1.normalizeResultData)(entry.output);
        if (table !== undefined && table.rows.length > 0)
            return table;
    }
    return undefined;
}
function readRunSummary(row) {
    return summarize(row, rebuildRun(row));
}
function summarize(row, { steps, plan }) {
    const summary = {};
    if (Array.isArray(row.tools)) {
        const tools = row.tools.filter((tool) => typeof tool === 'string');
        if (tools.length > 0)
            summary.tools = tools;
    }
    if (typeof row.execution_time === 'number' && Number.isFinite(row.execution_time)) {
        summary.executionMs = Math.round(row.execution_time * 1000);
    }
    const resultData = (0, result_data_1.normalizeResultData)(row.result_data) ?? lastToolOutput(row);
    if (resultData !== undefined)
        summary.resultData = resultData;
    // The stored trace rides along, so a run that streamed flat nests once it ends.
    if (steps.length > 0)
        summary.steps = steps;
    if (plan !== undefined)
        summary.plan = plan;
    return summary;
}
// ml-engine computes credits_remaining live and does not persist it, so it is present on a run
// that just executed and absent on one replayed from storage. It is read here, not dropped.
function mapUsage(usage) {
    if (!usage)
        return {};
    const mapped = {};
    if (typeof usage.prompt_tokens === 'number')
        mapped.tokensIn = usage.prompt_tokens;
    if (typeof usage.completion_tokens === 'number')
        mapped.tokensOut = usage.completion_tokens;
    if (typeof usage.calls === 'number')
        mapped.calls = usage.calls;
    if (typeof usage.cost_usd === 'number')
        mapped.costUsd = usage.cost_usd;
    if (typeof usage.credits_used === 'number')
        mapped.creditsUsed = usage.credits_used;
    if (typeof usage.credits_remaining === 'number') {
        mapped.creditsRemaining = usage.credits_remaining;
    }
    if (typeof usage.model === 'string')
        mapped.model = usage.model;
    return mapped;
}
function runStatusFrom(status) {
    if (status === exports.AGENTIC_STATUS.ERRORED)
        return 'error';
    if (status === exports.AGENTIC_STATUS.CANCELLED)
        return 'cancelled';
    if (status === exports.AGENTIC_STATUS.PROCESSING)
        return 'streaming';
    if (status === exports.AGENTIC_STATUS.PENDING)
        return 'queued';
    return 'done';
}
function emptyRun() {
    return { status: 'done', hasPlan: false, steps: [], text: '', charts: [], offline: false };
}
// `messages` is the raw chat array the run was built from, stored as JSON or as JSON text.
function parseMessages(value) {
    const parsed = typeof value === 'string'
        ? (() => {
            try {
                return JSON.parse(value);
            }
            catch {
                return undefined;
            }
        })()
        : value;
    if (!Array.isArray(parsed))
        return [];
    const messages = [];
    for (const entry of parsed) {
        if (!isRecord(entry))
            continue;
        const role = typeof entry.role === 'string' ? entry.role : '';
        const content = typeof entry.content === 'string' ? entry.content.trim() : '';
        if (content === '' || (role !== 'user' && role !== 'assistant'))
            continue;
        messages.push({ role, content });
    }
    return messages;
}
function chartsFrom(row, idPrefix) {
    if (!isRecord(row.chart_config) || Object.keys(row.chart_config).length === 0)
        return [];
    // chart_available is the flag the drawers gated on; an option object without it is still a
    // chart, so only an explicit false suppresses it.
    if (row.chart_available === false)
        return [];
    return [{ id: `${idPrefix}-chart-1`, option: row.chart_config }];
}
function timestampOf(row) {
    const raw = row.created_on ?? row.updated_on;
    const parsed = raw === undefined ? Number.NaN : Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : Date.now();
}
// Everything the row says about its own answer, applied over whatever text is already there.
function runFromRow(row, idPrefix, base) {
    const usage = mapUsage(row.usage);
    const error = row.error?.trim();
    const text = base.text === '' ? (row.response_text?.trim() ?? '') : base.text;
    const rebuilt = rebuildRun(row);
    const summary = summarize(row, rebuilt);
    return {
        ...base,
        ...summary,
        ...(rebuilt.route === undefined ? {} : { route: rebuilt.route }),
        ...(rebuilt.agent === undefined ? {} : { agent: rebuilt.agent }),
        status: runStatusFrom(row.status),
        hasPlan: summary.plan !== undefined || (Array.isArray(row.plan) && row.plan.length > 0),
        steps: summary.steps ?? [],
        charts: chartsFrom(row, idPrefix),
        text,
        ...(row.model ? { model: row.model } : {}),
        ...(row.model_tier === 'base' || row.model_tier === 'high' || row.model_tier === 'max'
            ? { modelTier: row.model_tier }
            : {}),
        ...(Object.keys(usage).length > 0 ? { usage } : {}),
        ...(error ? { error: { message: error } } : {}),
    };
}
// One AgenticMLRequest row is a whole thread: its `messages` array holds every exchange and its
// artifacts describe the latest answer, so they land on the last turn.
function transcriptFromRequest(row, threadId) {
    const createdAt = timestampOf(row);
    const turns = [];
    for (const message of parseMessages(row.messages)) {
        const last = turns[turns.length - 1];
        if (message.role === 'user' || last === undefined) {
            turns.push({
                id: `${threadId}-${turns.length}`,
                prompt: message.role === 'user' ? message.content : '',
                createdAt,
                run: message.role === 'user' ? emptyRun() : { ...emptyRun(), text: message.content },
            });
            continue;
        }
        if (last.run.text === '')
            last.run = { ...last.run, text: message.content };
    }
    if (turns.length === 0) {
        turns.push({
            id: `${threadId}-0`,
            prompt: row.prompt_text ?? '',
            createdAt,
            run: emptyRun(),
        });
    }
    const last = turns[turns.length - 1];
    if (last !== undefined)
        last.run = runFromRow(row, `${threadId}-${turns.length - 1}`, last.run);
    return turns;
}
// One ConversationTurn row is one turn, and its own `messages` delta already contributed the
// answer text through `response_text`.
function turnFromRow(row, threadId, index) {
    const id = row.id === undefined ? `${threadId}-${index}` : String(row.id);
    return {
        id,
        prompt: row.prompt_text ?? '',
        createdAt: timestampOf(row),
        run: runFromRow(row, id, emptyRun()),
    };
}
