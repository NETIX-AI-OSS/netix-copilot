import type { ReactNode } from 'react';
export declare function renderInline(text: string, keyPrefix: string): ReactNode[];
interface BlockBase {
    key: string;
}
type Block = (BlockBase & {
    kind: 'paragraph';
    lines: string[];
}) | (BlockBase & {
    kind: 'heading';
    level: 1 | 2 | 3;
    text: string;
}) | (BlockBase & {
    kind: 'code';
    language?: string;
    lines: string[];
    closed: boolean;
}) | (BlockBase & {
    kind: 'list';
    ordered: boolean;
    items: string[];
}) | (BlockBase & {
    kind: 'quote';
    lines: string[];
}) | (BlockBase & {
    kind: 'rule';
});
export declare function parseBlocks(markdown: string): Block[];
export interface MarkdownProps {
    text: string;
}
export declare function Markdown({ text }: MarkdownProps): ReactNode;
export {};
