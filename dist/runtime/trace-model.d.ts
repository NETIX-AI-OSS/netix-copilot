import type { PlanStep } from '../types';
export interface TraceNode {
    step: PlanStep;
    children: TraceNode[];
}
export declare function isAgentStep(step: PlanStep): boolean;
export declare function agentKey(nameOrTool: string): string | undefined;
export declare function buildTraceTree(steps: readonly PlanStep[]): TraceNode[];
export declare function agentSteps(steps: readonly PlanStep[]): PlanStep[];
export declare function countSteps(nodes: readonly TraceNode[]): number;
export declare function stepElapsedMs(step: PlanStep, nowMs?: number): number | undefined;
