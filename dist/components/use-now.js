"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNow = useNow;
exports.useSettled = useSettled;
const react_1 = require("react");
// The clock behind every live counter in the trace. It ticks only while `active`, holds its
// last reading once the run stops, and is undefined until the first tick so no render ever
// reads the wall clock. `now` is injectable for tests.
function useNow(active, now = Date.now, intervalMs = 1000) {
    const [value, setValue] = (0, react_1.useState)(undefined);
    const nowRef = (0, react_1.useRef)(now);
    (0, react_1.useEffect)(() => {
        nowRef.current = now;
    }, [now]);
    (0, react_1.useEffect)(() => {
        if (!active)
            return undefined;
        const id = setInterval(() => setValue(nowRef.current()), intervalMs);
        return () => clearInterval(id);
    }, [active, intervalMs]);
    return value;
}
// A value that follows `value` with a trailing delay, so a live region fed from it changes at
// most once per `delayMs` however fast the source moves.
function useSettled(value, delayMs) {
    const [settled, setSettled] = (0, react_1.useState)(value);
    (0, react_1.useEffect)(() => {
        const id = setTimeout(() => setSettled(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);
    return settled;
}
