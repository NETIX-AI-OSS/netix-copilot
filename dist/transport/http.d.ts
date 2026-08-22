export declare class CopilotHttpError extends Error {
    readonly status: number;
    readonly body: string;
    readonly detail: string | undefined;
    constructor(status: number, body: string, message?: string);
    get isResourceError(): boolean;
    get isRouteMissing(): boolean;
}
export declare function isRouteMissing(error: unknown): boolean;
export declare function isResourceError(error: unknown): boolean;
export type CopilotFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type AuthTokenProvider = () => string | null | undefined | Promise<string | null | undefined>;
export interface HttpConfig {
    baseUrl: string;
    getAuthToken?: AuthTokenProvider;
    fetchImpl?: CopilotFetch;
    headers?: Record<string, string>;
}
export declare function joinUrl(baseUrl: string, path: string): string;
export declare function buildHeaders(config: HttpConfig, extra?: Record<string, string>): Promise<Record<string, string>>;
export interface RequestOptions {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    accept?: string;
}
export declare function request(config: HttpConfig, path: string, options?: RequestOptions): Promise<Response>;
export declare function requestJson<T>(config: HttpConfig, path: string, options?: RequestOptions): Promise<T>;
