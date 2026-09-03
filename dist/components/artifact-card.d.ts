import type { ReactNode } from 'react';
export interface ArtifactCardProps {
    title: string;
    sub?: string;
    children: ReactNode;
}
export declare function ArtifactCard({ title, sub, children }: ArtifactCardProps): ReactNode;
