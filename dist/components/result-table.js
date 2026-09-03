"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasResultContent = hasResultContent;
exports.toCsv = toCsv;
exports.ResultTable = ResultTable;
const jsx_runtime_1 = require("react/jsx-runtime");
const context_1 = require("../adapters/context");
const result_data_1 = require("../transport/result-data");
const notify_1 = require("./notify");
// Matches what the drawer this replaces showed, so adopting the SDK is not a regression.
const MAX_VISIBLE_ROWS = 10;
// False for a scalar with nothing to print, so the caller can skip the card around it.
function hasResultContent(data) {
    if (data.columns.length > 0 && data.rows.length > 0)
        return true;
    return (0, result_data_1.formatResultCell)(data.raw) !== '';
}
function csvCell(value) {
    return `"${(0, result_data_1.formatResultCell)(value).replace(/"/g, '""')}"`;
}
// Every row, not the ten on screen: the export is how a user gets past the cap.
function toCsv(data) {
    const header = data.columns.map(csvCell).join(',');
    const body = data.rows.map((row) => data.columns.map((column) => csvCell(row[column])).join(','));
    return [header, ...body].join('\n');
}
function downloadCsv(csv) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'copilot-result.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoked after the click has been handed to the browser, not before.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// The tabular half of an answer: ml-engine returns the rows behind the prose, and losing them was
// the most visible thing hosts gave up when they moved onto the SDK.
function ResultTable({ data, maxRows = MAX_VISIBLE_ROWS }) {
    const { t } = (0, context_1.useCopilotAdapters)();
    const notify = (0, notify_1.useNotify)();
    // A scalar result has no columns at all. Printing the value beats printing an empty table.
    if (data.columns.length === 0 || data.rows.length === 0) {
        const scalar = (0, result_data_1.formatResultCell)(data.raw);
        if (scalar === '')
            return null;
        return ((0, jsx_runtime_1.jsx)("div", { className: 'nxcp-result', children: (0, jsx_runtime_1.jsx)("p", { className: 'nxcp-result-scalar', "aria-label": t('copilot.result.label'), children: scalar }) }));
    }
    const visible = data.rows.slice(0, maxRows);
    const exportCsv = () => {
        downloadCsv(toCsv(data));
        notify({ message: t('copilot.artifact.exported', { rows: data.rows.length }) });
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-result', children: [(0, jsx_runtime_1.jsx)("div", { className: 'nxcp-result-scroll', children: (0, jsx_runtime_1.jsxs)("table", { className: 'nxcp-table', "aria-label": t('copilot.result.label'), children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", { children: data.columns.map((column) => ((0, jsx_runtime_1.jsx)("th", { scope: 'col', children: column }, column))) }) }), (0, jsx_runtime_1.jsx)("tbody", { children: visible.map((row, index) => ((0, jsx_runtime_1.jsx)("tr", { children: data.columns.map((column) => ((0, jsx_runtime_1.jsx)("td", { children: (0, result_data_1.formatResultCell)(row[column]) }, column))) }, index))) })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: 'nxcp-result-foot', children: [data.rows.length > visible.length ? ((0, jsx_runtime_1.jsx)("p", { className: 'nxcp-result-more', children: t('copilot.result.more', { shown: visible.length, total: data.rows.length }) })) : null, (0, jsx_runtime_1.jsx)("button", { type: 'button', className: 'nxcp-result-export', onClick: exportCsv, children: t('copilot.artifact.downloadCsv') })] })] }));
}
