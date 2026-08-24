import type { ReactNode } from 'react';
import { type CopilotPanelProps } from './panel';
export interface CopilotDockProps extends Omit<CopilotPanelProps, 'className'> {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    showLauncher?: boolean;
    container?: HTMLElement | null;
}
export declare function CopilotDock({ open: openProp, onOpenChange, defaultOpen, showLauncher, container, headerActions, showThreads, ...panelProps }: CopilotDockProps): ReactNode;
