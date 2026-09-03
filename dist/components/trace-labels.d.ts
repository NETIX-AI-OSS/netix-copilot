import type { CopilotLabels, TranslateFn } from '../adapters/types';
import type { StepStatus } from '../types';
export type AgentDomain = 'netix' | 'cafm';
export declare function toolLabel(t: TranslateFn, labels: CopilotLabels | undefined, tool: string, status?: StepStatus): string;
export declare function agentLabel(t: TranslateFn, labels: CopilotLabels | undefined, nameOrTool: string): string;
export declare function agentDomain(key: string): AgentDomain;
export declare function formatDuration(ms: number): string;
