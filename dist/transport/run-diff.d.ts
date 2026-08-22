import type { EnvelopedEvent } from '../types';
import type { CopilotRunRow } from './transcript';
export interface RunSnapshot extends CopilotRunRow {
    turn_id?: number | string | null;
    conversation_id?: number | string | null;
}
export interface RunCursor {
    textLength: number;
    logCount: number;
    planEmitted: boolean;
    chartEmitted: boolean;
    usageSignature: string;
    runStarted: boolean;
    queuedEmitted: boolean;
}
export declare function encodeCursor(cursor: RunCursor): string;
export declare function decodeCursor(raw: string | undefined): RunCursor;
export declare function isTerminalStatus(status: number | undefined): boolean;
export declare function diffRunSnapshot(snapshot: RunSnapshot, cursor: RunCursor, turnId: string): EnvelopedEvent[];
