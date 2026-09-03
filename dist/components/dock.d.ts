import type { ReactNode } from 'react';
import { type CopilotPanelProps } from './panel';
export type CopilotDockMode = 'min' | 'dock' | 'full';
export interface CopilotDockProps extends Omit<CopilotPanelProps, 'className' | 'layout'> {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    showLauncher?: boolean;
    container?: HTMLElement | null;
    mode?: CopilotDockMode;
    onModeChange?: (mode: CopilotDockMode) => void;
}
export declare function CopilotDock({ open: openProp, onOpenChange, defaultOpen, showLauncher, container, mode: modeProp, onModeChange, headerActions, showThreads, ...panelProps }: CopilotDockProps): ReactNode;
