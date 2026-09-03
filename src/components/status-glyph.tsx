import type { ReactNode } from 'react'

import type { StepStatus } from '../types'

export type GlyphKind = 'dots' | 'ring' | 'tick' | 'cross' | 'stop' | 'shield' | 'clock' | 'dash'

const STEP_GLYPHS: Record<StepStatus, GlyphKind> = {
  pending: 'clock',
  running: 'ring',
  ok: 'tick',
  error: 'cross',
  skipped: 'dash',
  awaiting_approval: 'shield',
  rejected: 'cross',
  cancelled: 'stop',
}

export function stepGlyph(status: StepStatus): GlyphKind {
  return STEP_GLYPHS[status]
}

const ICON_PATHS: Partial<Record<GlyphKind, string>> = {
  tick: 'M4 12l5 5L20 6',
  cross: 'M6 6l12 12M18 6L6 18',
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 3',
  dash: 'M5 12h14',
}

export interface StatusGlyphProps {
  glyph: GlyphKind
  // The visually hidden status text that stands in for the picture.
  label: string
  size?: number
}

// One picture per status, drawn from CSS or an inline path so no icon set is bundled. The
// picture is hidden from assistive technology and the label carries its meaning instead.
export function StatusGlyph({ glyph, label, size = 12 }: StatusGlyphProps): ReactNode {
  const path = ICON_PATHS[glyph]
  return (
    <>
      <span
        className='nxcp-glyph'
        data-glyph={glyph}
        aria-hidden='true'
        style={glyph === 'dots' ? undefined : { width: size, height: size }}
      >
        {glyph === 'dots' ? (
          <>
            <span className='nxcp-glyph-dot' />
            <span className='nxcp-glyph-dot' />
            <span className='nxcp-glyph-dot' />
          </>
        ) : null}
        {glyph === 'stop' ? <span className='nxcp-glyph-stop' /> : null}
        {path ? (
          <svg viewBox='0 0 24 24' width={size} height={size} fill='none' stroke='currentColor'>
            <path d={path} strokeWidth={2.6} strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        ) : null}
      </span>
      <span className='nxcp-sr-only'>{label}</span>
    </>
  )
}
