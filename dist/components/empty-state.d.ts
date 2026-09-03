import type { ReactNode } from 'react';
export declare function SparkIcon({ size }: {
    size: number;
}): ReactNode;
export interface QuickPromptsProps {
    chips: readonly string[];
    onSelect: (prompt: string) => void;
}
export declare function QuickPrompts({ chips, onSelect }: QuickPromptsProps): ReactNode;
export interface EmptyStateProps extends QuickPromptsProps {
    heading: ReactNode;
    body: ReactNode;
}
export declare function EmptyState({ heading, body, chips, onSelect }: EmptyStateProps): ReactNode;
