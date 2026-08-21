import type { ReactNode } from 'react';
import type { PlanStep } from '../types';
export interface PlanTimelineProps {
    steps: PlanStep[];
    hasPlan: boolean;
}
export declare function PlanTimeline({ steps, hasPlan }: PlanTimelineProps): ReactNode;
