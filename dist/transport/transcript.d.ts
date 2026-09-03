import type { CopilotRunSummary, CopilotUsage, PlanStep, RunPlan, RunRoute, RunState } from '../types';
import type { CopilotTranscriptTurn } from './types';
export declare const AGENTIC_STATUS: {
    readonly PENDING: 0;
    readonly COMPLETED: 1;
    readonly ERRORED: 2;
    readonly PROCESSING: 3;
    readonly CANCELLED: 4;
};
export interface CopilotRunRow {
    id?: number | string;
    status?: number;
    prompt_text?: string;
    response_text?: string | null;
    chart_config?: Record<string, unknown> | null;
    chart_available?: boolean | null;
    plan?: unknown[] | null;
    execution_log?: unknown[] | null;
    tools?: readonly (string | null)[] | null;
    error?: string | null;
    execution_time?: number | null;
    usage?: Record<string, unknown> | null;
    result_data?: unknown;
    messages?: unknown;
    model?: string | null;
    model_tier?: string | null;
    created_on?: string;
    updated_on?: string;
}
export declare function summarizeArguments(value: unknown): string | undefined;
export declare function readStepId(entry: Record<string, unknown>, index: number): string;
export declare function readStepTitle(entry: Record<string, unknown>, index: number): string;
export declare function planSteps(plan: unknown[]): PlanStep[];
export declare function logStep(entry: Record<string, unknown>, index: number): PlanStep;
export declare function logSteps(entry: Record<string, unknown>, index: number): PlanStep[];
export declare function readPlanOutput(entry: Record<string, unknown>): RunPlan | undefined;
export interface RebuiltRun {
    steps: PlanStep[];
    plan?: RunPlan;
    route?: RunRoute;
    agent?: string;
}
export declare function rebuildRun(row: CopilotRunRow): RebuiltRun;
export declare function mergeSteps(steps: PlanStep[]): PlanStep[];
export declare function readRunSummary(row: CopilotRunRow): CopilotRunSummary;
export declare function mapUsage(usage: Record<string, unknown> | null | undefined): CopilotUsage;
export declare function runStatusFrom(status: number | undefined): RunState['status'];
export declare function emptyRun(): RunState;
export declare function parseMessages(value: unknown): Array<{
    role: string;
    content: string;
}>;
export declare function timestampOf(row: CopilotRunRow): number;
export declare function runFromRow(row: CopilotRunRow, idPrefix: string, base: RunState): RunState;
export declare function transcriptFromRequest(row: CopilotRunRow, threadId: string): CopilotTranscriptTurn[];
export declare function turnFromRow(row: CopilotRunRow, threadId: string, index: number): CopilotTranscriptTurn;
