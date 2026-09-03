"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryRail = HistoryRail;
exports.ThreadsPopover = ThreadsPopover;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const context_1 = require("../adapters/context");
const notify_1 = require("./notify");
const MS_DAY = 86400000;
const MS_MINUTE = 60000;
const TITLE_MAX = 48;
const GROUP_ORDER = ['pinned', 'today', 'yesterday', 'week', 'earlier'];
function localDay(ms) {
    return new Date(ms).setHours(0, 0, 0, 0);
}
// Calendar days between two instants in the viewer's zone; rounding absorbs DST hours.
function daysAgo(ms, now) {
    return Math.round((localDay(now) - localDay(ms)) / MS_DAY);
}
function groupOf(thread, now) {
    if (thread.isPinned)
        return 'pinned';
    const ago = daysAgo(thread.updatedAt, now);
    return ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : ago <= 6 ? 'week' : 'earlier';
}
function whenLabel(ms, now, t) {
    const ago = daysAgo(ms, now);
    const date = new Date(ms);
    if (ago <= 0) {
        return date.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
    }
    if (ago === 1)
        return t('copilot.history.yesterday');
    if (ago <= 6)
        return date.toLocaleDateString(undefined, { weekday: 'short' });
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function clip(title) {
    return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}
function subscribeMinute(listener) {
    const handle = setInterval(listener, MS_MINUTE);
    return () => clearInterval(handle);
}
// Quantised to the minute, so every render inside one minute reads the same value and the
// grouping cannot tear between a render and its commit.
function minuteNow() {
    return Math.floor(Date.now() / MS_MINUTE) * MS_MINUTE;
}
function useMinuteClock() {
    return (0, react_1.useSyncExternalStore)(subscribeMinute, minuteNow, minuteNow);
}
function HistoryRail({ compact = false, now: nowProp, autoLoad = true, }) {
    const { t, logger: adapterLogger } = (0, context_1.useCopilotAdapters)();
    const config = (0, context_1.useCopilotConfig)();
    const logger = adapterLogger ?? config.logger;
    const engine = (0, context_1.useCopilotEngine)();
    const state = (0, context_1.useCopilotState)();
    const notify = (0, notify_1.useNotify)();
    const clock = useMinuteClock();
    const now = nowProp ?? clock;
    const baseId = (0, react_1.useId)();
    const [search, setSearch] = (0, react_1.useState)('');
    const [menuId, setMenuId] = (0, react_1.useState)();
    const [renameId, setRenameId] = (0, react_1.useState)();
    const [renameValue, setRenameValue] = (0, react_1.useState)('');
    const [confirmId, setConfirmId] = (0, react_1.useState)();
    const openRow = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!autoLoad || state.threadsLoaded)
            return;
        void engine.loadThreads();
    }, [autoLoad, engine, state.threadsLoaded]);
    (0, react_1.useEffect)(() => {
        if (menuId === undefined)
            return;
        const onPointerDown = (event) => {
            if (openRow.current?.contains(event.target))
                return;
            setMenuId(undefined);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [menuId]);
    const term = search.trim().toLowerCase();
    const visible = state.threads
        .filter((thread) => term === '' || thread.title.toLowerCase().includes(term))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    const groups = GROUP_ORDER.map((group) => ({
        group,
        items: visible.filter((thread) => groupOf(thread, now) === group),
    })).filter((entry) => entry.items.length > 0);
    const commitRename = (thread) => {
        const title = renameValue.trim() || t('copilot.history.untitled');
        setRenameId(undefined);
        if (title === thread.title)
            return;
        // The engine already logs a refused update and restores the row.
        void engine.updateThread(thread.id, { title }).catch(() => undefined);
    };
    const togglePin = (thread) => {
        setMenuId(undefined);
        void engine.updateThread(thread.id, { isPinned: !thread.isPinned }).catch(() => undefined);
    };
    const remove = (thread) => {
        setConfirmId(undefined);
        void engine
            .deleteThread(thread.id)
            .then(() => notify({ message: t('copilot.history.deleted') }))
            .catch((error) => logger?.warn('netix-copilot: thread delete failed', error));
    };
    const renderRow = (thread) => {
        const active = thread.id === state.threadId;
        const menuOpen = menuId === thread.id;
        return ((0, jsx_runtime_1.jsx)("li", { className: 'nxcp-thread-row', ref: menuOpen ? openRow : undefined, onKeyDown: (event) => {
                if (event.key === 'Escape' && menuOpen)
                    setMenuId(undefined);
            }, children: renameId === thread.id ? ((0, jsx_runtime_1.jsx)("input", { className: 'nxcp-thread-rename', "aria-label": t('copilot.history.rename'), autoFocus: true, value: renameValue, onChange: (event) => setRenameValue(event.target.value), onKeyDown: (event) => {
                    if (event.key === 'Enter')
                        commitRename(thread);
                    if (event.key === 'Escape') {
                        // Escape here must not also close the popover the rail may sit in.
                        event.stopPropagation();
                        setRenameId(undefined);
                    }
                } })) : confirmId === thread.id ? ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-thread-confirm', role: 'group', "aria-label": t('copilot.history.confirmDelete'), children: [(0, jsx_runtime_1.jsx)("span", { children: t('copilot.history.confirmDelete') }), (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', "data-tone": 'danger', onClick: () => remove(thread), children: t('copilot.history.delete') }), (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button', onClick: () => setConfirmId(undefined), children: t('copilot.history.cancel') })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("button", { type: 'button', className: 'nxcp-thread', "aria-current": active ? 'true' : undefined, onClick: () => engine.selectThread(thread.id), children: [(0, jsx_runtime_1.jsx)("span", { className: 'nxcp-thread-title', children: clip(thread.title) || t('copilot.history.untitled') }), (0, jsx_runtime_1.jsxs)("span", { className: 'nxcp-thread-meta', children: [thread.modelTier ? ((0, jsx_runtime_1.jsx)("span", { className: 'nxcp-badge', children: t(`copilot.tier.${thread.modelTier}`) })) : null, thread.surface ? (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-badge', children: thread.surface }) : null, (0, jsx_runtime_1.jsx)("span", { className: 'nxcp-thread-time', children: whenLabel(thread.updatedAt, now, t) })] })] }), (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-icon-button nxcp-thread-kebab', "aria-label": t('copilot.history.menu'), "aria-haspopup": 'menu', "aria-expanded": menuOpen, onClick: () => setMenuId(menuOpen ? undefined : thread.id), children: (0, jsx_runtime_1.jsxs)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'currentColor', "aria-hidden": 'true', children: [(0, jsx_runtime_1.jsx)("circle", { cx: '5', cy: '12', r: '1.7' }), (0, jsx_runtime_1.jsx)("circle", { cx: '12', cy: '12', r: '1.7' }), (0, jsx_runtime_1.jsx)("circle", { cx: '19', cy: '12', r: '1.7' })] }) }), menuOpen ? ((0, jsx_runtime_1.jsxs)("div", { role: 'menu', className: 'nxcp-thread-menu', children: [(0, jsx_runtime_1.jsx)("button", { type: 'button', role: 'menuitem', onClick: () => togglePin(thread), children: t(thread.isPinned ? 'copilot.history.unpin' : 'copilot.history.pin') }), (0, jsx_runtime_1.jsx)("button", { type: 'button', role: 'menuitem', onClick: () => {
                                    setMenuId(undefined);
                                    setRenameValue(thread.title);
                                    setRenameId(thread.id);
                                }, children: t('copilot.history.rename') }), (0, jsx_runtime_1.jsx)("button", { type: 'button', role: 'menuitem', "data-tone": 'danger', onClick: () => {
                                    setMenuId(undefined);
                                    setConfirmId(thread.id);
                                }, children: t('copilot.history.delete') })] })) : null] })) }, thread.id));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-history', "data-compact": compact ? 'true' : 'false', children: [compact ? null : ((0, jsx_runtime_1.jsxs)("button", { type: 'button', className: 'nxcp-history-new', onClick: () => engine.startNewThread(), children: [(0, jsx_runtime_1.jsx)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M12 5v14M5 12h14' }) }), t('copilot.dock.new')] })), (0, jsx_runtime_1.jsxs)("label", { className: 'nxcp-history-search', children: [(0, jsx_runtime_1.jsxs)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, "aria-hidden": 'true', children: [(0, jsx_runtime_1.jsx)("circle", { cx: '11', cy: '11', r: '7' }), (0, jsx_runtime_1.jsx)("path", { d: 'm20 20-3.5-3.5' })] }), (0, jsx_runtime_1.jsx)("input", { type: 'search', value: search, "aria-label": t('copilot.history.search'), placeholder: t('copilot.history.search'), onChange: (event) => setSearch(event.target.value) })] }), !state.threadsLoaded ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: t('copilot.threads.loading') })) : groups.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-empty', children: term === ''
                    ? t('copilot.threads.empty')
                    : t('copilot.history.noMatch', { search: search.trim() }) })) : ((0, jsx_runtime_1.jsx)("nav", { className: 'nxcp-history-list', "aria-label": t('copilot.threads.label'), children: groups.map(({ group, items }) => ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: 'nxcp-history-group', id: `${baseId}-${group}`, children: t(`copilot.history.${group}`) }), (0, jsx_runtime_1.jsx)("ul", { className: 'nxcp-history-items', "aria-labelledby": `${baseId}-${group}`, children: items.map(renderRow) })] }, group))) }))] }));
}
// The dock's header control: an icon button that drops the compact rail below it. Closes on
// Escape, on a click outside, and once a conversation has been chosen.
function ThreadsPopover() {
    const { t } = (0, context_1.useCopilotAdapters)();
    const { threadId } = (0, context_1.useCopilotState)();
    // Remembers which conversation was open when the popover opened, so choosing another one
    // closes it without an effect.
    const [openedOn, setOpenedOn] = (0, react_1.useState)(null);
    const open = openedOn !== null && openedOn.thread === threadId;
    const setOpen = (next) => setOpenedOn(next ? { thread: threadId } : null);
    const trigger = (0, react_1.useRef)(null);
    const popover = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        const onPointerDown = (event) => {
            const target = event.target;
            if (popover.current?.contains(target) || trigger.current?.contains(target))
                return;
            setOpenedOn(null);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                setOpenedOn(null);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("button", { ref: trigger, type: 'button', className: 'nxcp-icon-button', "aria-label": t('copilot.threads.label'), title: t('copilot.threads.label'), "aria-haspopup": 'dialog', "aria-expanded": open, onClick: () => setOpen(!open), children: (0, jsx_runtime_1.jsx)("svg", { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', "aria-hidden": 'true', children: (0, jsx_runtime_1.jsx)("path", { d: 'M4 6h16M4 12h16M4 18h10' }) }) }), open ? ((0, jsx_runtime_1.jsx)("div", { ref: popover, role: 'dialog', "aria-label": t('copilot.threads.label'), className: 'nxcp-threads-popover', children: (0, jsx_runtime_1.jsx)(HistoryRail, { compact: true }) })) : null] }));
}
