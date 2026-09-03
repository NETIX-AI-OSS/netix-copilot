"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadList = ThreadList;
const jsx_runtime_1 = require("react/jsx-runtime");
const history_rail_1 = require("./history-rail");
// Kept for hosts on the v0.3 API: the compact rail is what the old thread strip became.
function ThreadList({ autoLoad = true }) {
    return (0, jsx_runtime_1.jsx)(history_rail_1.HistoryRail, { compact: true, autoLoad: autoLoad });
}
