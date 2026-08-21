import type { ReactNode } from 'react';
import type { CopilotTurnView } from '../runtime/engine';
export interface MessageViewProps {
    turn: CopilotTurnView;
    showBadges?: boolean;
    showResultData?: boolean;
}
export declare function MessageView({ turn, showBadges, showResultData, }: MessageViewProps): ReactNode;
