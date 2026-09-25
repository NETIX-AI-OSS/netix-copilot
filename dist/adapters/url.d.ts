export declare const COPILOT_URL_PARAMS: {
    readonly open: "ai_open";
    readonly thread: "thread";
};
export interface CopilotUrlState {
    get(param: string): string | null;
    set(changes: Record<string, string | null>): void;
}
/** The URL that opens the dock over `path`, on `threadId` when one is given. */
export declare function copilotDeepLink(threadId?: string, path?: string): string;
/** The thread a URL names; a blank `?thread=` is absent. */
export declare function readUrlThread(url: CopilotUrlState): string | undefined;
/** Open when the flag is set, or when a thread is named (a briefing link minted without the flag). */
export declare function isUrlOpen(url: CopilotUrlState): boolean;
