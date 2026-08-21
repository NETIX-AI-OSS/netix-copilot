import type { ReactNode } from 'react';
import type { TransportName } from '../transport/types';
import type { CopilotUsage } from '../types';
export interface UsageFooterProps {
    usage?: CopilotUsage;
    transport?: TransportName;
    model?: string;
}
export declare function UsageFooter({ usage, transport, model }: UsageFooterProps): ReactNode;
