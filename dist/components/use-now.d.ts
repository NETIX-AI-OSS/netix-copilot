export type NowFn = () => number;
export declare function useNow(active: boolean, now?: NowFn, intervalMs?: number): number | undefined;
export declare function useSettled<T>(value: T, delayMs: number): T;
