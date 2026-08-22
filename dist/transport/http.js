"use strict";
// Thin fetch wrapper. The SDK owns its own HTTP so it works identically inside viz-ui (SWR) and
// cafm-v2-ui (react-query) without depending on either.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotHttpError = void 0;
exports.isRouteMissing = isRouteMissing;
exports.joinUrl = joinUrl;
exports.buildHeaders = buildHeaders;
exports.request = request;
exports.requestJson = requestJson;
class CopilotHttpError extends Error {
    constructor(status, body, message) {
        super(message ?? `Copilot request failed with status ${status}`);
        this.name = 'CopilotHttpError';
        this.status = status;
        this.body = body;
    }
    // 404/405/501 on the stream endpoint means the streaming route is not deployed yet.
    get isRouteMissing() {
        return this.status === 404 || this.status === 405 || this.status === 501;
    }
}
exports.CopilotHttpError = CopilotHttpError;
// A 404/405/501 says the route is not deployed on this cluster, not that the request was bad.
function isRouteMissing(error) {
    return error instanceof CopilotHttpError && error.isRouteMissing;
}
function joinUrl(baseUrl, path) {
    if (/^https?:\/\//i.test(path))
        return path;
    const base = baseUrl.replace(/\/+$/, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
}
async function buildHeaders(config, extra) {
    const headers = { ...config.headers, ...extra };
    const token = await config.getAuthToken?.();
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return headers;
}
function resolveFetch(config) {
    if (config.fetchImpl)
        return config.fetchImpl;
    if (typeof fetch === 'function')
        return (input, init) => fetch(input, init);
    throw new Error('netix-copilot requires a fetch implementation.');
}
// Perform a request and return the raw Response, throwing CopilotHttpError on a non-2xx.
async function request(config, path, options = {}) {
    const method = options.method ?? 'GET';
    const headers = await buildHeaders(config, {
        Accept: options.accept ?? 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
    });
    const init = { method, headers };
    if (options.body !== undefined)
        init.body = JSON.stringify(options.body);
    if (options.signal)
        init.signal = options.signal;
    const response = await resolveFetch(config)(joinUrl(config.baseUrl, path), init);
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new CopilotHttpError(response.status, body);
    }
    return response;
}
async function requestJson(config, path, options = {}) {
    const response = await request(config, path, options);
    const text = await response.text();
    if (text.trim() === '')
        return {};
    return JSON.parse(text);
}
