import type { ReactNode } from 'react';
import type { StepStatus } from '../types';
export type GlyphKind = 'dots' | 'ring' | 'tick' | 'cross' | 'stop' | 'shield' | 'clock' | 'dash';
export declare function stepGlyph(status: StepStatus): GlyphKind;
export interface StatusGlyphProps {
    glyph: GlyphKind;
    label: string;
    size?: number;
}
export declare function StatusGlyph({ glyph, label, size }: StatusGlyphProps): ReactNode;
