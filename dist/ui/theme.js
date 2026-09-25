"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeToCssVars = themeToCssVars;
exports.hostVariableTheme = hostVariableTheme;
const TOKEN_TO_VARIABLE = {
    surface: '--nxcp-surface',
    surfaceMuted: '--nxcp-surface-muted',
    surface2: '--nxcp-surface-2',
    surface3: '--nxcp-surface-3',
    border: '--nxcp-border',
    borderStrong: '--nxcp-border-strong',
    text: '--nxcp-text',
    textMuted: '--nxcp-text-muted',
    textTertiary: '--nxcp-text-tertiary',
    accent: '--nxcp-accent',
    accentText: '--nxcp-accent-text',
    accentSubtle: '--nxcp-accent-subtle',
    domainCafm: '--nxcp-domain-cafm',
    danger: '--nxcp-danger',
    success: '--nxcp-success',
    warning: '--nxcp-warning',
    radius: '--nxcp-radius',
    radiusSm: '--nxcp-radius-sm',
    radiusMd: '--nxcp-radius-md',
    radiusLg: '--nxcp-radius-lg',
    radiusXl: '--nxcp-radius-xl',
    radiusPill: '--nxcp-radius-pill',
    fontFamily: '--nxcp-font',
    monoFontFamily: '--nxcp-mono',
    shadow: '--nxcp-shadow',
    elev1: '--nxcp-elev-1',
    elev2: '--nxcp-elev-2',
    elev3: '--nxcp-elev-3',
    focusRing: '--nxcp-focus-ring',
    motionFast: '--nxcp-motion-fast',
    motionBase: '--nxcp-motion-base',
};
// Theme tokens become CSS custom properties on the dock root, so the host controls every colour
// without this package importing a stylesheet or knowing which Tailwind major it is running on.
function themeToCssVars(theme) {
    const style = {};
    for (const [token, variable] of Object.entries(TOKEN_TO_VARIABLE)) {
        const value = theme[token];
        if (typeof value === 'string' && value !== '')
            style[variable] = value;
    }
    if (theme.colorScheme)
        style.colorScheme = theme.colorScheme;
    return style;
}
// The token → host-variable map for hosts on the shadcn / NETIX token set (`--card`, `--muted`,
// `--primary`, `--border`, …). Each value is a live `var()` reference, not a colour read once: the
// browser resolves it on the dock root, so a theme preset or dark-mode switch in the host restyles
// the dock with no code and no re-render. Every reference carries this package's own default as
// the fallback, so a host missing an optional variable (`--elev-2`, `--motion-fast`, …) still
// renders the stock look. `colorScheme` is left out on purpose: it inherits from the host page.
const HOST_VARIABLE_THEME = {
    surface: 'var(--card, #ffffff)',
    surfaceMuted: 'var(--muted, #f8fafc)',
    surface2: 'var(--muted, #f8fafc)',
    surface3: 'var(--secondary, color-mix(in srgb, var(--muted, #f8fafc) 95%, var(--foreground, #0f172a)))',
    border: 'var(--border, #e6eaf0)',
    borderStrong: 'var(--border-strong, color-mix(in srgb, var(--border, #e6eaf0) 88%, var(--foreground, #0f172a)))',
    text: 'var(--foreground, #0f172a)',
    textMuted: 'var(--muted-foreground, #475569)',
    textTertiary: 'var(--text-tertiary, color-mix(in srgb, var(--muted-foreground, #475569) 85%, var(--card, #ffffff)))',
    accent: 'var(--primary, #1d63e0)',
    accentText: 'var(--primary-foreground, #ffffff)',
    accentSubtle: 'var(--primary-subtle, var(--primary-light, color-mix(in srgb, var(--primary, #1d63e0) 12%, var(--card, #ffffff))))',
    domainCafm: 'var(--status-info, #0e7c86)',
    danger: 'var(--destructive, #c8372d)',
    success: 'var(--status-success, var(--status-ok, #1f8a54))',
    warning: 'var(--status-warning, #b8730a)',
    radius: 'var(--radius-lg, 14px)',
    radiusSm: 'var(--radius-sm, 6px)',
    radiusMd: 'var(--radius-md, 10px)',
    radiusLg: 'var(--radius-lg, 14px)',
    radiusPill: 'var(--radius-pill, 999px)',
    // The dock portals into document.body, so inheriting picks up the host's own font stack.
    fontFamily: 'inherit',
    monoFontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    shadow: 'var(--elev-3, 0 12px 32px rgba(16, 24, 40, 0.16))',
    elev1: 'var(--elev-1, 0 1px 2px rgba(16, 24, 40, 0.06))',
    elev2: 'var(--elev-2, 0 4px 12px rgba(16, 24, 40, 0.08))',
    elev3: 'var(--elev-3, 0 12px 32px rgba(16, 24, 40, 0.16))',
    focusRing: '0 0 0 3px color-mix(in srgb, var(--ring, #1d63e0) 45%, transparent)',
    motionFast: 'var(--motion-fast, 120ms ease-out)',
    motionBase: 'var(--motion-base, 220ms cubic-bezier(0.2, 0.7, 0.2, 1))',
};
/**
 * A theme that follows the host's CSS variables live (shadcn / NETIX names). Pass it as
 * `adapters.theme`; `overrides` replaces single tokens, e.g. `{ domainCafm: 'var(--brand-cafm)' }`.
 */
function hostVariableTheme(overrides = {}) {
    return { ...HOST_VARIABLE_THEME, ...overrides };
}
