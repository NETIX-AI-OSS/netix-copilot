import type { ReactNode } from 'react';
import type { PlanStep } from '../types';
export interface ApprovalCardProps {
    step: PlanStep;
}
export declare function ApprovalCard({ step }: ApprovalCardProps): ReactNode;
