import type { ReactNode } from 'react';
import type { PlanStep } from '../types';
export interface AgentCardProps {
    step: PlanStep;
    nowMs?: number;
    children?: ReactNode;
}
export declare function AgentCard({ step, nowMs, children }: AgentCardProps): ReactNode;
