import type { ReactNode } from 'react';
import type { RunState } from '../types';
import type { NowFn } from './use-now';
export interface ReasoningTraceProps {
    run: RunState;
    defaultOpen?: boolean;
    now?: NowFn;
}
export declare function ReasoningTrace({ run, defaultOpen, now }: ReasoningTraceProps): ReactNode;
