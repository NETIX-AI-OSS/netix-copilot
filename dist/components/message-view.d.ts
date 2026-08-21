import type { ReactNode } from 'react';
import type { CopilotTurnView } from '../runtime/engine';
export interface MessageViewProps {
    turn: CopilotTurnView;
}
export declare function MessageView({ turn }: MessageViewProps): ReactNode;
