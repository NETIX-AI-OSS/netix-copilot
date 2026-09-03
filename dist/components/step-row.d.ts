import type { ReactNode } from 'react';
import type { PlanStep } from '../types';
export interface StepRowProps {
    step: PlanStep;
    nowMs?: number;
    children?: ReactNode;
}
export declare function StepRow({ step, nowMs, children }: StepRowProps): ReactNode;
