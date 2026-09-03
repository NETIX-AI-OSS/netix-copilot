"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamInterruptedError = exports.NotStreamableError = exports.newIdempotencyKey = exports.isTerminalEvent = exports.turnFromRow = exports.transcriptFromRequest = exports.rebuildRun = exports.readPlanOutput = exports.logSteps = exports.SseTransport = exports.DEFAULT_SSE_ENDPOINTS = exports.SseParser = exports.readSseStream = exports.isTerminalStatus = exports.encodeCursor = exports.diffRunSnapshot = exports.decodeCursor = exports.normalizeResultData = exports.formatResultCell = exports.isRouteMissing = exports.isResourceError = exports.CopilotHttpError = exports.decodePolledEvent = exports.decodeFrame = exports.AutoTransport = exports.DEFAULT_AGENTIC_ENDPOINTS = exports.AgenticTransport = exports.AGENTIC_STATUS = void 0;
exports.createTransport = createTransport;
const agentic_transport_1 = require("./agentic-transport");
const auto_transport_1 = require("./auto-transport");
const sse_transport_1 = require("./sse-transport");
function createTransport(config) {
    const http = {
        baseUrl: config.baseUrl,
        ...(config.getAuthToken ? { getAuthToken: config.getAuthToken } : {}),
        ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
        ...(config.headers ? { headers: config.headers } : {}),
    };
    const streaming = new sse_transport_1.SseTransport({
        ...http,
        ...(config.sseEndpoints ? { endpoints: config.sseEndpoints } : {}),
        ...(config.pollIntervalMs === undefined ? {} : { pollIntervalMs: config.pollIntervalMs }),
        ...(config.sleepImpl ? { sleepImpl: config.sleepImpl } : {}),
    });
    const polling = new agentic_transport_1.AgenticTransport({
        ...http,
        ...(config.agenticEndpoints ? { endpoints: config.agenticEndpoints } : {}),
        ...(config.getIdentity ? { getIdentity: config.getIdentity } : {}),
        ...(config.maxTokens === undefined ? {} : { maxTokens: config.maxTokens }),
        ...(config.pollIntervalMs === undefined ? {} : { pollIntervalMs: config.pollIntervalMs }),
        ...(config.maxPollIntervalMs === undefined
            ? {}
            : { maxPollIntervalMs: config.maxPollIntervalMs }),
        ...(config.sleepImpl ? { sleepImpl: config.sleepImpl } : {}),
    });
    switch (config.transport ?? 'auto') {
        case 'sse':
            return streaming;
        case 'agentic':
            return polling;
        default:
            return new auto_transport_1.AutoTransport(streaming, polling);
    }
}
var agentic_transport_2 = require("./agentic-transport");
Object.defineProperty(exports, "AGENTIC_STATUS", { enumerable: true, get: function () { return agentic_transport_2.AGENTIC_STATUS; } });
Object.defineProperty(exports, "AgenticTransport", { enumerable: true, get: function () { return agentic_transport_2.AgenticTransport; } });
Object.defineProperty(exports, "DEFAULT_AGENTIC_ENDPOINTS", { enumerable: true, get: function () { return agentic_transport_2.DEFAULT_AGENTIC_ENDPOINTS; } });
var auto_transport_2 = require("./auto-transport");
Object.defineProperty(exports, "AutoTransport", { enumerable: true, get: function () { return auto_transport_2.AutoTransport; } });
var decode_1 = require("./decode");
Object.defineProperty(exports, "decodeFrame", { enumerable: true, get: function () { return decode_1.decodeFrame; } });
Object.defineProperty(exports, "decodePolledEvent", { enumerable: true, get: function () { return decode_1.decodePolledEvent; } });
var http_1 = require("./http");
Object.defineProperty(exports, "CopilotHttpError", { enumerable: true, get: function () { return http_1.CopilotHttpError; } });
Object.defineProperty(exports, "isResourceError", { enumerable: true, get: function () { return http_1.isResourceError; } });
Object.defineProperty(exports, "isRouteMissing", { enumerable: true, get: function () { return http_1.isRouteMissing; } });
var result_data_1 = require("./result-data");
Object.defineProperty(exports, "formatResultCell", { enumerable: true, get: function () { return result_data_1.formatResultCell; } });
Object.defineProperty(exports, "normalizeResultData", { enumerable: true, get: function () { return result_data_1.normalizeResultData; } });
var run_diff_1 = require("./run-diff");
Object.defineProperty(exports, "decodeCursor", { enumerable: true, get: function () { return run_diff_1.decodeCursor; } });
Object.defineProperty(exports, "diffRunSnapshot", { enumerable: true, get: function () { return run_diff_1.diffRunSnapshot; } });
Object.defineProperty(exports, "encodeCursor", { enumerable: true, get: function () { return run_diff_1.encodeCursor; } });
Object.defineProperty(exports, "isTerminalStatus", { enumerable: true, get: function () { return run_diff_1.isTerminalStatus; } });
var sse_1 = require("./sse");
Object.defineProperty(exports, "readSseStream", { enumerable: true, get: function () { return sse_1.readSseStream; } });
Object.defineProperty(exports, "SseParser", { enumerable: true, get: function () { return sse_1.SseParser; } });
var sse_transport_2 = require("./sse-transport");
Object.defineProperty(exports, "DEFAULT_SSE_ENDPOINTS", { enumerable: true, get: function () { return sse_transport_2.DEFAULT_SSE_ENDPOINTS; } });
Object.defineProperty(exports, "SseTransport", { enumerable: true, get: function () { return sse_transport_2.SseTransport; } });
var transcript_1 = require("./transcript");
Object.defineProperty(exports, "logSteps", { enumerable: true, get: function () { return transcript_1.logSteps; } });
Object.defineProperty(exports, "readPlanOutput", { enumerable: true, get: function () { return transcript_1.readPlanOutput; } });
Object.defineProperty(exports, "rebuildRun", { enumerable: true, get: function () { return transcript_1.rebuildRun; } });
Object.defineProperty(exports, "transcriptFromRequest", { enumerable: true, get: function () { return transcript_1.transcriptFromRequest; } });
Object.defineProperty(exports, "turnFromRow", { enumerable: true, get: function () { return transcript_1.turnFromRow; } });
var types_1 = require("./types");
Object.defineProperty(exports, "isTerminalEvent", { enumerable: true, get: function () { return types_1.isTerminalEvent; } });
Object.defineProperty(exports, "newIdempotencyKey", { enumerable: true, get: function () { return types_1.newIdempotencyKey; } });
Object.defineProperty(exports, "NotStreamableError", { enumerable: true, get: function () { return types_1.NotStreamableError; } });
Object.defineProperty(exports, "StreamInterruptedError", { enumerable: true, get: function () { return types_1.StreamInterruptedError; } });
