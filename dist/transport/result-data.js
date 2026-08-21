"use strict";
// Normalizes whatever `result_data` came back into one table shape.
//
// The field is a JSONField on ml-engine and every producer fills it differently: the SQL tools
// return { columns, data }, some tools return a bare list of row objects, and a scalar answer
// returns a number. Older rows store the whole thing as a JSON string. Callers should not have to
// know that, so this collapses all of it to { columns, rows } and keeps the original under `raw`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeResultData = normalizeResultData;
exports.formatResultCell = formatResultCell;
const MAX_COLUMNS = 40;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// ml-engine stores result_data as JSON text on some rows and as real JSON on others.
function parseMaybeJson(value) {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    if (trimmed === '')
        return undefined;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return value;
    }
}
function asColumns(value) {
    if (!Array.isArray(value))
        return undefined;
    const columns = value
        .filter((entry) => typeof entry === 'string' || typeof entry === 'number')
        .map((entry) => String(entry));
    return columns.length === 0 ? undefined : columns.slice(0, MAX_COLUMNS);
}
// Column order comes from the backend when it sends one, otherwise from the order keys first
// appear across the rows, which keeps a ragged result readable.
function deriveColumns(rows) {
    const seen = [];
    for (const row of rows) {
        if (!isRecord(row))
            continue;
        for (const key of Object.keys(row)) {
            if (!seen.includes(key))
                seen.push(key);
            if (seen.length >= MAX_COLUMNS)
                return seen;
        }
    }
    return seen;
}
function toRow(entry, columns) {
    if (isRecord(entry))
        return entry;
    // A positional row lines up with the declared columns; a bare value becomes a one-column row.
    if (Array.isArray(entry)) {
        const row = {};
        entry.forEach((cell, index) => {
            const key = columns[index] ?? `column_${index + 1}`;
            row[key] = cell;
        });
        return row;
    }
    return { [columns[0] ?? 'value']: entry };
}
function buildRows(list, declared) {
    const positional = list.some((entry) => Array.isArray(entry));
    const columns = declared ?? (positional ? [] : deriveColumns(list));
    const rows = list.map((entry) => toRow(entry, columns));
    const resolved = columns.length > 0 ? columns : deriveColumns(rows);
    return { columns: resolved, rows, raw: list };
}
// Returns undefined only when there is genuinely nothing to show.
function normalizeResultData(value) {
    const parsed = parseMaybeJson(value);
    if (parsed === undefined || parsed === null)
        return undefined;
    if (Array.isArray(parsed)) {
        if (parsed.length === 0)
            return undefined;
        return buildRows(parsed, undefined);
    }
    if (isRecord(parsed)) {
        const declared = asColumns(parsed.columns);
        const list = parsed.data ?? parsed.rows ?? parsed.records ?? parsed.results;
        if (Array.isArray(list)) {
            const table = buildRows(list, declared);
            return { ...table, raw: parsed };
        }
        const entries = Object.entries(parsed);
        if (entries.length === 0)
            return undefined;
        // A plain object is a one-record result; showing it as key/value beats hiding it.
        return {
            columns: ['key', 'value'],
            rows: entries.map(([key, entry]) => ({ key, value: entry })),
            raw: parsed,
        };
    }
    return { columns: [], rows: [], raw: parsed };
}
// Render one cell without ever printing "[object Object]".
function formatResultCell(value) {
    if (value === undefined || value === null)
        return '';
    if (typeof value === 'object')
        return JSON.stringify(value);
    return String(value);
}
