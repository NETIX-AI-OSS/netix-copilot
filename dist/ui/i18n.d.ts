export declare const COPILOT_STRINGS: Record<string, string>;
export type TranslateVars = Record<string, string | number>;
export declare function interpolate(template: string, vars?: TranslateVars): string;
export declare function createFallbackTranslate(overrides?: Record<string, string>): (key: string, vars?: TranslateVars) => string;
