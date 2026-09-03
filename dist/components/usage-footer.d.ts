import type { ReactNode } from 'react';
import type { TransportName } from '../transport/types';
import type { CopilotUsage, ModelTier } from '../types';
export interface UsageFooterProps {
    usage?: CopilotUsage;
    transport?: TransportName;
    model?: string;
    modelTier?: ModelTier;
}
export declare function UsageFooter({ usage, transport, modelTier }: UsageFooterProps): ReactNode;
