"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadList = ThreadList;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
function ThreadList({ autoLoad = true }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const engine = (0, context_1.useCopilotEngine)();
    const state = (0, context_1.useCopilotState)();
    (0, react_1.useEffect)(() => {
        if (!autoLoad || state.threadsLoaded)
            return;
        void engine.loadThreads();
    }, [autoLoad, engine, state.threadsLoaded]);
    if (!state.threadsLoaded) {
        return (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-empty', children: t('copilot.threads.loading') });
    }
    if (state.threads.length === 0) {
        return (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-empty', children: t('copilot.threads.empty') });
    }
    return ((0, jsx_runtime_1.jsx)("nav", { className: 'nxcp-threads', "aria-label": t('copilot.threads.label'), children: state.threads.map((thread) => ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-thread', "aria-current": thread.id === state.threadId ? 'true' : 'false', onClick: () => engine.selectThread(thread.id), children: (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-thread-title', children: thread.title }) }, thread.id))) }));
}
