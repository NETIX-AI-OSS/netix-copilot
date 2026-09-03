"use strict";
// One way to say "done" after a small action: copied, exported, deleted. A host with its own
// toaster supplies `adapters.notify`; otherwise the SDK's bottom-centre pill (toast-pill.tsx)
// shows it.
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStore = void 0;
exports.setFallbackNotify = setFallbackNotify;
exports.useNotify = useNotify;
const react_1 = require("react");
const context_1 = require("../adapters/context");
// A toast carrying an action needs time to read and reach; a plain confirmation does not.
const ACTION_TIMEOUT_MS = 5200;
const PLAIN_TIMEOUT_MS = 3000;
const listeners = new Set();
let snapshot = { current: undefined };
let timer;
function emit(current) {
    snapshot = { current };
    for (const listener of listeners)
        listener();
}
// Module-level so the pill can sit anywhere in the tree and a notification raised before it
// mounts is still the one it shows. One slot and one timer: a new toast replaces the old.
exports.notificationStore = {
    subscribe(listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
    getSnapshot() {
        return snapshot;
    },
    show(notification) {
        if (timer !== undefined)
            clearTimeout(timer);
        emit(notification);
        timer = setTimeout(() => exports.notificationStore.dismiss(), notification.action ? ACTION_TIMEOUT_MS : PLAIN_TIMEOUT_MS);
    },
    dismiss() {
        if (timer !== undefined)
            clearTimeout(timer);
        timer = undefined;
        if (snapshot.current !== undefined)
            emit(undefined);
    },
};
let fallbackNotify = exports.notificationStore.show;
function setFallbackNotify(notify) {
    fallbackNotify = notify;
}
function useNotify() {
    const { notify } = (0, context_1.useCopilotAdapters)();
    return (0, react_1.useCallback)((notification) => (notify ?? fallbackNotify)(notification), [notify]);
}
