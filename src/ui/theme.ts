import type { CSSProperties } from 'react'

import type { CopilotThemeTokens } from '../adapters/types'

const TOKEN_TO_VARIABLE: Record<keyof Omit<CopilotThemeTokens, 'colorScheme'>, string> = {
  surface: '--nxcp-surface',
  surfaceMuted: '--nxcp-surface-muted',
  border: '--nxcp-border',
  text: '--nxcp-text',
  textMuted: '--nxcp-text-muted',
  accent: '--nxcp-accent',
  accentText: '--nxcp-accent-text',
  danger: '--nxcp-danger',
  success: '--nxcp-success',
  warning: '--nxcp-warning',
  radius: '--nxcp-radius',
  fontFamily: '--nxcp-font',
  monoFontFamily: '--nxcp-mono',
  shadow: '--nxcp-shadow',
}

// Theme tokens become CSS custom properties on the dock root, so the host controls every colour
// without this package importing a stylesheet or knowing which Tailwind major it is running on.
export function themeToCssVars(theme: CopilotThemeTokens): CSSProperties {
  const style: Record<string, string> = {}
  for (const [token, variable] of Object.entries(TOKEN_TO_VARIABLE)) {
    const value = theme[token as keyof typeof TOKEN_TO_VARIABLE]
    if (typeof value === 'string' && value !== '') style[variable] = value
  }
  if (theme.colorScheme) style.colorScheme = theme.colorScheme
  return style as CSSProperties
}
