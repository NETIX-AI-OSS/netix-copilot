"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultTable = ResultTable;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const result_data_1 = require("../transport/result-data");
// Matches what the drawer this replaces showed, so adopting the SDK is not a regression.
const MAX_VISIBLE_ROWS = 10;
// The tabular half of an answer: ml-engine returns the rows behind the prose, and losing them was
// the most visible thing hosts gave up when they moved onto the SDK.
function ResultTable({ data, maxRows = MAX_VISIBLE_ROWS }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    // A scalar result has no columns at all. Printing the value beats printing an empty table.
    if (data.columns.length === 0 || data.rows.length === 0) {
        const scalar = (0, result_data_1.formatResultCell)(data.raw);
        if (scalar === '')
            return null;
        return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-result', children: [(0, jsx_runtime_1.jsx)("div", { className: 'nxcp-result-caption', children: t('copilot.result.label') }), (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-result-scalar', children: scalar })] }));
    }
    const visible = data.rows.slice(0, maxRows);
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-result', children: [(0, jsx_runtime_1.jsx)("div", { className: 'nxcp-result-caption', children: t('copilot.result.label') }), (0, jsx_runtime_1.jsx)("div", { className: 'nxcp-result-scroll', children: (0, jsx_runtime_1.jsxs)("table", { className: 'nxcp-table', children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", { children: data.columns.map((column) => ((0, jsx_runtime_1.jsx)("th", { scope: 'col', children: column }, column))) }) }), (0, jsx_runtime_1.jsx)("tbody", { children: visible.map((row, index) => ((0, jsx_runtime_1.jsx)("tr", { children: data.columns.map((column) => ((0, jsx_runtime_1.jsx)("td", { children: (0, result_data_1.formatResultCell)(row[column]) }, column))) }, index))) })] }) }), data.rows.length > visible.length ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-result-more', children: t('copilot.result.more', { shown: visible.length, total: data.rows.length }) })) : null] }));
}
