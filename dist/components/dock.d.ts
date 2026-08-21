import type { ReactNode } from 'react';
export interface CopilotDockProps {
    headerActions?: ReactNode;
    defaultOpen?: boolean;
    showThreads?: boolean;
    container?: HTMLElement | null;
}
export declare function CopilotDock({ headerActions, defaultOpen, showThreads, container, }: CopilotDockProps): ReactNode;
