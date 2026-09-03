import type { ReactNode } from 'react';
export interface HistoryRailProps {
    compact?: boolean;
    now?: number;
    autoLoad?: boolean;
}
export declare function HistoryRail({ compact, now: nowProp, autoLoad, }: HistoryRailProps): ReactNode;
export declare function ThreadsPopover(): ReactNode;
