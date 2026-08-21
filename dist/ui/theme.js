"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeToCssVars = themeToCssVars;
const TOKEN_TO_VARIABLE = {
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
