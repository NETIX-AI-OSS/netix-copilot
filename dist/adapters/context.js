"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COPILOT_PERMISSION = void 0;
exports.CopilotProvider = CopilotProvider;
exports.useCopilotEngine = useCopilotEngine;
exports.useCopilotAdapters = useCopilotAdapters;
exports.useCopilotConfig = useCopilotConfig;
exports.useCopilotState = useCopilotState;
exports.useCopilotRun = useCopilotRun;
exports.useCopilotModelTier = useCopilotModelTier;
exports.useCopilotEnabled = useCopilotEnabled;
exports.useCopilotSend = useCopilotSend;
exports.useCopilotThreadActions = useCopilotThreadActions;
exports.useCopilotRegenerate = useCopilotRegenerate;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const engine_1 = require("../runtime/engine");
const transport_1 = require("../transport");
const types_1 = require("./types");
const CopilotContext = (0, react_1.createContext)(null);
exports.DEFAULT_COPILOT_PERMISSION = 'ai-assistant-view';
function CopilotProvider({ config, adapters, transport, children, }) {
    // Built once, by a lazy state initializer, so the engine identity survives every host render.
    // Nothing here reads the adapters: the identity the agentic contract needs travels with each
    // turn's scope instead, which keeps this a pure render.
    const [engine] = (0, react_1.useState)(() => new engine_1.CopilotEngine({
        transport: transport ?? (0, transport_1.createTransport)(config),
        ...(config.teardownGraceMs === undefined
            ? {}
            : { teardownGraceMs: config.teardownGraceMs }),
        ...(config.maxResumeAttempts === undefined
            ? {}
            : { maxResumeAttempts: config.maxResumeAttempts }),
        ...(config.resumeDelayMs === undefined ? {} : { resumeDelayMs: config.resumeDelayMs }),
        ...(config.logger ? { logger: config.logger } : {}),
        ...(config.conversationSurface ? { conversationSurface: config.conversationSurface } : {}),
    }));
    (0, react_1.useEffect)(() => {
        engine.retain();
        return () => {
            // release(), never dispose(): StrictMode runs this cleanup between two mounts and a live
            // run has to survive it. release() only stops work if nothing re-retains within the grace.
            engine.release();
        };
    }, [engine]);
    const value = (0, react_1.useMemo)(() => ({ engine, adapters, config }), [engine, adapters, config]);
    return (0, jsx_runtime_1.jsx)(CopilotContext.Provider, { value: value, children: children });
}
function useCopilotContext() {
    const value = (0, react_1.useContext)(CopilotContext);
    if (value === null) {
        throw new Error('netix-copilot: this hook must be used inside <CopilotProvider>.');
    }
    return value;
}
function useCopilotEngine() {
    return useCopilotContext().engine;
}
function useCopilotAdapters() {
    return useCopilotContext().adapters;
}
function useCopilotConfig() {
    return useCopilotContext().config;
}
function useCopilotState() {
    const { engine } = useCopilotContext();
    return (0, react_1.useSyncExternalStore)(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
// The run of the newest turn, or undefined before the first send.
function useCopilotRun() {
    const state = useCopilotState();
    return state.turns[state.turns.length - 1]?.run;
}
function useCopilotModelTier() {
    const engine = useCopilotEngine();
    const state = useCopilotState();
    return {
        tier: state.modelTier,
        locked: state.modelTierLocked,
        setTier: (tier) => engine.setModelTier(tier),
    };
}
// Whether the current user may use the copilot at all.
function useCopilotEnabled() {
    const { adapters, config } = useCopilotContext();
    return adapters.hasPermission(config.permission ?? exports.DEFAULT_COPILOT_PERMISSION);
}
// Send the composer's text with the host's page context attached as scope, running it through
// the host's prompt transform first so a wire-only suffix never reaches the user's own bubble.
function useCopilotSend() {
    const { engine, adapters } = useCopilotContext();
    return (prompt) => {
        const { threadId, contextEnabled } = engine.getSnapshot();
        const { display, wire } = (0, types_1.resolveCopilotPrompt)(prompt, adapters.transformPrompt, {
            pageContext: adapters.pageContext,
            isFirstMessage: threadId === undefined,
            includeContext: contextEnabled,
            ...(threadId === undefined ? {} : { threadId }),
        });
        void engine.send(display, (0, types_1.buildScope)(adapters.pageContext), { wireText: wire });
    };
}
// The history rail's kebab, bound to the engine. The engine already reverts its optimistic list
// edit when the backend refuses, so a failure here is logged and never thrown at a click handler.
function useCopilotThreadActions() {
    const { engine, adapters, config } = useCopilotContext();
    const logger = adapters.logger ?? config.logger;
    return (0, react_1.useMemo)(() => {
        const guarded = (label, work) => work.catch((error) => logger?.warn(`netix-copilot: ${label} failed`, error));
        return {
            rename: (threadId, title) => guarded('rename', engine.updateThread(threadId, { title })),
            pin: (threadId, on) => guarded('pin', engine.updateThread(threadId, { isPinned: on })),
            remove: (threadId) => guarded('delete', engine.deleteThread(threadId)),
        };
    }, [engine, logger]);
}
// Ask the same question again as a new turn on the same thread. The transcript is server-owned,
// so the earlier answer stays; the wire text is reused verbatim so the backend sees exactly what
// it saw the first time.
function useCopilotRegenerate() {
    const { engine, adapters } = useCopilotContext();
    return (turnId) => {
        const turn = engine.getSnapshot().turns.find((entry) => entry.id === turnId);
        if (!turn)
            return;
        void engine.send(turn.prompt, (0, types_1.buildScope)(adapters.pageContext), turn.wirePrompt === undefined ? undefined : { wireText: turn.wirePrompt });
    };
}
