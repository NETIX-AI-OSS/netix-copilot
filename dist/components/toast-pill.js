"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToastHost = ToastHost;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const notify_1 = require("./notify");
// A global dock and an embedded panel can be mounted at once, and each carries a ToastHost.
// Only the first mounted one paints, so a notification never shows twice.
const hostIds = [];
const hostListeners = new Set();
let hostSeq = 0;
function subscribeHosts(listener) {
    hostListeners.add(listener);
    return () => {
        hostListeners.delete(listener);
    };
}
function useIsPrimaryHost() {
    const [id] = (0, react_1.useState)(() => {
        hostSeq += 1;
        return hostSeq;
    });
    (0, react_1.useEffect)(() => {
        hostIds.push(id);
        for (const listener of hostListeners)
            listener();
        return () => {
            hostIds.splice(hostIds.indexOf(id), 1);
            for (const listener of hostListeners)
                listener();
        };
    }, [id]);
    return (0, react_1.useSyncExternalStore)(subscribeHosts, () => hostIds[0] === id, () => false);
}
function ToastHost() {
    const { t } = (0, context_1.useCopilotAdapters)();
    const { current } = (0, react_1.useSyncExternalStore)(notify_1.notificationStore.subscribe, notify_1.notificationStore.getSnapshot, notify_1.notificationStore.getSnapshot);
    const primary = useIsPrimaryHost();
    if (!primary)
        return null;
    const action = current?.action;
    // The live region stays mounted while empty, or assistive tech never hears the first toast.
    return ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-toast-region', role: 'status', "aria-live": 'polite', children: current ? ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-toast', "data-tone": current.tone ?? 'info', children: [(0, jsx_runtime_1.jsx)("span", { children: current.message }), action ? ((0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-toast-action', onClick: () => {
                        action.onSelect();
                        notify_1.notificationStore.dismiss();
                    }, children: action.label })) : null, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-toast-dismiss', "aria-label": t('copilot.toast.dismiss'), onClick: () => notify_1.notificationStore.dismiss(), children: (0, jsx_runtime_1.jsx)("svg", { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M6 6l12 12M18 6L6 18' }) }) })] })) : null }));
}
