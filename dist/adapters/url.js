"use strict";
// The dock's deep-link contract: `?ai_open=1` opens it, `&thread=<id>` restores a conversation.
// The package reads and writes these through a host adapter, so it stays router-agnostic.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPILOT_URL_PARAMS = void 0;
exports.copilotDeepLink = copilotDeepLink;
exports.readUrlThread = readUrlThread;
exports.isUrlOpen = isUrlOpen;
exports.COPILOT_URL_PARAMS = { open: 'ai_open', thread: 'thread' };
/** The URL that opens the dock over `path`, on `threadId` when one is given. */
function copilotDeepLink(threadId, path = '/') {
    const search = new URLSearchParams({ [exports.COPILOT_URL_PARAMS.open]: '1' });
    if (threadId)
        search.set(exports.COPILOT_URL_PARAMS.thread, threadId);
    return `${path}?${search.toString()}`;
}
/** The thread a URL names; a blank `?thread=` is absent. */
function readUrlThread(url) {
    const thread = url.get(exports.COPILOT_URL_PARAMS.thread);
    return thread === null || thread === '' ? undefined : thread;
}
/** Open when the flag is set, or when a thread is named (a briefing link minted without the flag). */
function isUrlOpen(url) {
    return url.get(exports.COPILOT_URL_PARAMS.open) === '1' || readUrlThread(url) !== undefined;
}
