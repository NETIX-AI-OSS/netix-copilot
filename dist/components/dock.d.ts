import type { ReactNode } from 'react';
export interface CopilotDockProps {
    headerActions?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    showThreads?: boolean;
    showLauncher?: boolean;
    container?: HTMLElement | null;
}
export declare function CopilotDock({ headerActions, open: openProp, onOpenChange, defaultOpen, showThreads, showLauncher, container, }: CopilotDockProps): ReactNode;
