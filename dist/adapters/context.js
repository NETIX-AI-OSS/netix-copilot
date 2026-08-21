"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COPILOT_PERMISSION = void 0;
exports.CopilotProvider = CopilotProvider;
exports.useCopilotEngine = useCopilotEngine;
exports.useCopilotAdapters = useCopilotAdapters;
exports.useCopilotConfig = useCopilotConfig;
exports.useCopilotState = useCopilotState;
exports.useCopilotRun = useCopilotRun;
exports.useCopilotEnabled = useCopilotEnabled;
exports.useCopilotSend = useCopilotSend;
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
// Whether the current user may use the copilot at all.
function useCopilotEnabled() {
    const { adapters, config } = useCopilotContext();
    return adapters.hasPermission(config.permission ?? exports.DEFAULT_COPILOT_PERMISSION);
}
// Send the composer's text with the host's page context attached as scope.
function useCopilotSend() {
    const { engine, adapters } = useCopilotContext();
    return (prompt) => {
        void engine.send(prompt, (0, types_1.buildScope)(adapters.pageContext));
    };
}
