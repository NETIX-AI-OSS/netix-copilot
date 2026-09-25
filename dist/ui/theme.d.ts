import type { CSSProperties } from 'react';
import type { CopilotThemeTokens } from '../adapters/types';
export declare function themeToCssVars(theme: CopilotThemeTokens): CSSProperties;
/**
 * A theme that follows the host's CSS variables live (shadcn / NETIX names). Pass it as
 * `adapters.theme`; `overrides` replaces single tokens, e.g. `{ domainCafm: 'var(--brand-cafm)' }`.
 */
export declare function hostVariableTheme(overrides?: CopilotThemeTokens): CopilotThemeTokens;
