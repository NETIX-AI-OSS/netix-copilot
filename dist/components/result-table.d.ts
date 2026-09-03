import type { ReactNode } from 'react';
import type { CopilotResultData } from '../types';
export interface ResultTableProps {
    data: CopilotResultData;
    maxRows?: number;
}
export declare function hasResultContent(data: CopilotResultData): boolean;
export declare function toCsv(data: CopilotResultData): string;
export declare function ResultTable({ data, maxRows }: ResultTableProps): ReactNode;
