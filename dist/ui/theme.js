"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeToCssVars = themeToCssVars;
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
