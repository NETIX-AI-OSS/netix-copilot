import type { ReactNode } from 'react';
import type { CopilotTurnView } from '../runtime/engine';
import type { RunState } from '../types';
export interface AnswerActionsProps {
    turn: CopilotTurnView;
    showCaption?: boolean;
}
export declare function groundingCounts(run: RunState): {
    tools: number;
    agents: number;
};
export declare function AnswerActions({ turn, showCaption }: AnswerActionsProps): ReactNode;
