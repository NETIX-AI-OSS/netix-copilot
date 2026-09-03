import type { ReactNode } from 'react';
import type { CopilotTurnView } from '../runtime/engine';
export interface CopilotPanelProps {
    title?: ReactNode;
    headerActions?: ReactNode;
    footerActions?: ReactNode;
    emptyState?: ReactNode;
    quickPrompts?: readonly string[];
    showThreads?: boolean;
    autoFocus?: boolean;
    className?: string;
    layout?: 'dock' | 'full';
    renderTurn?: (turn: CopilotTurnView, defaultView: ReactNode) => ReactNode;
}
export declare function CopilotPanel({ title, headerActions, footerActions, emptyState, quickPrompts, showThreads, autoFocus, className, layout, renderTurn, }: CopilotPanelProps): ReactNode;
