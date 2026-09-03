import type { ReactNode } from 'react';
export declare function SparkIcon({ size }: {
    size: number;
}): ReactNode;
export interface EmptyStateProps {
    heading: ReactNode;
    body: ReactNode;
    chips: readonly string[];
    onSelect: (prompt: string) => void;
}
export declare function EmptyState({ heading, body, chips, onSelect }: EmptyStateProps): ReactNode;
