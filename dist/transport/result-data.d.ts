import type { CopilotResultData, JsonValue } from '../types';
export declare function normalizeResultData(value: unknown): CopilotResultData | undefined;
export declare function formatResultCell(value: JsonValue | undefined): string;
