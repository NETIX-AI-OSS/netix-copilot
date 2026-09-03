"use strict";
// Styling ships as one injected stylesheet plus CSS custom properties.
//
// No CSS file to import, no Tailwind classes: viz-ui and cafm-v2-ui are on Tailwind 3.4 while
// prism-ui is on Tailwind 4.3, and a shared package cannot depend on either compiling its class
// names. Every selector is prefixed `nxcp-` and every colour resolves from a variable the theme
// adapter sets, so a host restyles the dock without touching this file. Logical properties only,
// so an RTL host needs no overrides.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPILOT_CSS = exports.COPILOT_STYLE_ELEMENT_ID = void 0;
exports.injectCopilotStyles = injectCopilotStyles;
const trace_1 = require("./styles/trace");
const transcript_1 = require("./styles/transcript");
const z_index_1 = require("./z-index");
exports.COPILOT_STYLE_ELEMENT_ID = 'netix-copilot-styles';
// Shell: tokens, launcher, dock, panel chrome, history, toast, banners, empty state, footer.
// Transcript and trace rules live in ./styles/ so the three areas can evolve independently.
const SHELL_CSS = `
.nxcp-root {
  --nxcp-surface: #ffffff;
  --nxcp-surface-muted: #f8fafc;
  --nxcp-surface-2: var(--nxcp-surface-muted);
  --nxcp-surface-3: #eef2f7;
  --nxcp-border: #e6eaf0;
  --nxcp-border-strong: #cbd5e1;
  --nxcp-text: #0f172a;
  --nxcp-text-muted: #475569;
  --nxcp-text-tertiary: #5e6b7b;
  --nxcp-accent: #1d63e0;
  --nxcp-accent-text: #ffffff;
  --nxcp-accent-subtle: #e5eefd;
  --nxcp-domain-cafm: #0e7c86;
  --nxcp-danger: #c8372d;
  --nxcp-success: #1f8a54;
  --nxcp-warning: #b8730a;
  --nxcp-radius: 14px;
  --nxcp-radius-sm: 6px;
  --nxcp-radius-md: 10px;
  --nxcp-radius-lg: 14px;
  --nxcp-radius-pill: 999px;
  --nxcp-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --nxcp-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --nxcp-elev-1: 0 1px 2px rgba(16, 24, 40, 0.06);
  --nxcp-elev-2: 0 4px 12px rgba(16, 24, 40, 0.08);
  --nxcp-elev-3: 0 12px 32px rgba(16, 24, 40, 0.16);
  --nxcp-shadow: var(--nxcp-elev-3);
  --nxcp-focus-ring: 0 0 0 3px rgba(29, 99, 224, 0.45);
  --nxcp-motion-fast: 120ms ease-out;
  --nxcp-motion-base: 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
  color: var(--nxcp-text);
  font-family: var(--nxcp-font);
  font-size: 14px;
  line-height: 1.55;
}
.nxcp-root:focus-visible,
.nxcp-root :focus-visible {
  outline: none;
  box-shadow: var(--nxcp-focus-ring);
}
@keyframes nxcp-modal-in {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes nxcp-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes nxcp-halo {
  0% { transform: scale(0.82); opacity: 0.5; }
  70% { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
}
.nxcp-launcher {
  position: fixed;
  inset-inline-end: 24px;
  bottom: 24px;
  z-index: ${z_index_1.COPILOT_Z_INDEX.launcher};
  display: inline-flex;
  align-items: center;
  height: 52px;
  padding: 0 9px;
  border: 0;
  border-radius: 26px;
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: var(--nxcp-elev-3), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  animation: nxcp-modal-in 0.18s ease-out;
}
.nxcp-launcher:focus-visible {
  box-shadow: var(--nxcp-elev-3), var(--nxcp-focus-ring);
}
.nxcp-launcher-halo {
  position: absolute;
  inset-inline-end: 0;
  bottom: 0;
  z-index: -1;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--nxcp-accent);
  pointer-events: none;
  animation: nxcp-halo 2.8s ease-out infinite;
}
.nxcp-launcher[data-expanded='true'] .nxcp-launcher-halo {
  animation: none;
  opacity: 0;
}
.nxcp-launcher-tile {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: var(--nxcp-accent-text);
  color: var(--nxcp-accent);
  box-shadow: inset 0 0 0 1px rgba(29, 99, 224, 0.18);
}
.nxcp-launcher-label {
  position: relative;
  max-width: 0;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.15;
  text-align: start;
  transform: translateX(-6px);
  transition:
    max-width var(--nxcp-motion-base),
    padding var(--nxcp-motion-base),
    opacity 0.22s ease 0.07s,
    transform 0.28s cubic-bezier(0.2, 0.8, 0.25, 1);
}
.nxcp-launcher-label:dir(rtl) { transform: translateX(6px); }
.nxcp-launcher[data-expanded='true'] .nxcp-launcher-label {
  max-width: 240px;
  padding-inline-start: 10px;
  opacity: 1;
  transform: none;
}
.nxcp-launcher-chevron {
  position: relative;
  flex: none;
  opacity: 0.85;
  margin-inline: 8px 4px;
}
.nxcp-launcher-chevron:dir(rtl) { transform: scaleX(-1); }
.nxcp-dock {
  position: fixed;
  inset-inline-end: 22px;
  bottom: 22px;
  z-index: ${z_index_1.COPILOT_Z_INDEX.dock};
  display: flex;
  flex-direction: column;
  max-width: 94vw;
  height: min(680px, 86vh);
  background: var(--nxcp-surface);
  border: 1px solid var(--nxcp-border-strong);
  border-radius: var(--nxcp-radius-lg);
  box-shadow: var(--nxcp-elev-3);
  animation: nxcp-modal-in 0.18s ease-out;
}
.nxcp-dock > .nxcp-panel {
  flex: 1;
  border-radius: inherit;
}
.nxcp-resize {
  position: absolute;
  top: 0;
  inset-inline-start: -3px;
  z-index: 1;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  border: 0;
  padding: 0;
}
.nxcp-resize:hover,
.nxcp-resize:focus-visible {
  background: var(--nxcp-accent);
  opacity: 0.35;
  box-shadow: none;
}
.nxcp-panel {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--nxcp-surface);
}
.nxcp-panel[data-layout='full'] {
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-lg);
  box-shadow: var(--nxcp-elev-1);
}
.nxcp-header,
.nxcp-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--nxcp-border);
}
.nxcp-header { flex-wrap: wrap; }
.nxcp-footer {
  border-bottom: 0;
  border-top: 1px solid var(--nxcp-border);
  color: var(--nxcp-text-muted);
  font-size: 12px;
  flex-wrap: wrap;
}
.nxcp-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}
.nxcp-title svg { flex: none; }
.nxcp-caption {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  color: var(--nxcp-text-tertiary);
}
.nxcp-header-actions {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
}
.nxcp-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-sm);
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: color var(--nxcp-motion-fast), border-color var(--nxcp-motion-fast);
}
.nxcp-icon-button:hover:not(:disabled) {
  color: var(--nxcp-text);
  border-color: var(--nxcp-border-strong);
}
.nxcp-icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nxcp-icon-button[data-tone='danger'] {
  color: var(--nxcp-danger);
  border-color: var(--nxcp-danger);
}
.nxcp-threads-popover {
  position: absolute;
  top: calc(100% + 6px);
  inset-inline-end: 0;
  z-index: ${z_index_1.COPILOT_Z_INDEX.popover};
  display: flex;
  flex-direction: column;
  width: 300px;
  max-height: min(420px, 60vh);
  padding: 10px;
  box-sizing: border-box;
  background: var(--nxcp-surface);
  border: 1px solid var(--nxcp-border-strong);
  border-radius: var(--nxcp-radius-md);
  box-shadow: var(--nxcp-elev-3);
  animation: nxcp-modal-in 0.12s ease-out;
}
.nxcp-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.nxcp-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.nxcp-history-new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 9px 13px;
  border: 0;
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.nxcp-history-search {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text-tertiary);
}
.nxcp-history-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--nxcp-text);
  font: inherit;
  font-size: 12px;
}
.nxcp-history-search input:focus-visible { box-shadow: none; }
.nxcp-history-search:focus-within { border-color: var(--nxcp-accent); }
.nxcp-history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.nxcp-history-group {
  padding: 9px 6px 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nxcp-text-tertiary);
}
.nxcp-thread-row {
  position: relative;
  display: flex;
  flex-direction: column;
}
.nxcp-thread {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  width: 100%;
  padding: 8px;
  padding-inline-end: 32px;
  border: 1px solid transparent;
  border-radius: var(--nxcp-radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.nxcp-thread:hover { background: var(--nxcp-surface-2); }
.nxcp-thread[aria-current='true'] {
  background: var(--nxcp-surface-2);
  border-color: var(--nxcp-accent);
}
.nxcp-thread-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--nxcp-text);
}
.nxcp-thread-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.nxcp-thread-meta .nxcp-badge {
  padding: 0 6px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: transparent;
}
.nxcp-thread-time {
  margin-inline-start: auto;
  font-size: 10.5px;
  white-space: nowrap;
  color: var(--nxcp-text-tertiary);
}
.nxcp-thread-kebab {
  position: absolute;
  top: 6px;
  inset-inline-end: 6px;
  min-width: 24px;
  height: 24px;
  padding: 0;
  border-color: transparent;
  background: transparent;
  color: var(--nxcp-text-tertiary);
  line-height: 0;
}
.nxcp-thread-menu {
  position: absolute;
  top: 30px;
  inset-inline-end: 6px;
  z-index: ${z_index_1.COPILOT_Z_INDEX.popover};
  display: flex;
  flex-direction: column;
  min-width: 132px;
  overflow: hidden;
  background: var(--nxcp-surface);
  border: 1px solid var(--nxcp-border-strong);
  border-radius: var(--nxcp-radius-md);
  box-shadow: var(--nxcp-elev-3);
  animation: nxcp-modal-in 0.12s ease-out;
}
.nxcp-thread-menu [role='menuitem'] {
  padding: 8px 12px;
  border: 0;
  background: none;
  color: var(--nxcp-text);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}
.nxcp-thread-menu [role='menuitem']:hover { background: var(--nxcp-surface-2); }
.nxcp-thread-menu [role='menuitem'][data-tone='danger'] { color: var(--nxcp-danger); }
.nxcp-thread-rename {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 8px 0;
  padding: 4px 8px;
  border: 1px solid var(--nxcp-accent);
  border-radius: var(--nxcp-radius-sm);
  background: var(--nxcp-surface);
  color: var(--nxcp-text);
  font: inherit;
  font-size: 13px;
}
.nxcp-thread-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
  padding: 8px;
  border: 1px solid var(--nxcp-danger);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface);
  font-size: 12px;
  color: var(--nxcp-text-muted);
}
.nxcp-thread-confirm span { flex: 1 1 100%; }
.nxcp-history[data-compact='true'] .nxcp-thread { padding-block: 6px; }
.nxcp-empty {
  color: var(--nxcp-text-muted);
  padding: 8px 10px;
  font-size: 12.5px;
}
.nxcp-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: auto 0;
  padding: 8px 4px;
  box-sizing: border-box;
}
.nxcp-empty-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-accent-subtle);
  color: var(--nxcp-accent);
}
.nxcp-empty-heading {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: var(--nxcp-text);
}
.nxcp-empty-body {
  margin: 0;
  max-width: 520px;
  text-align: center;
  font-size: 13px;
  line-height: 1.6;
  color: var(--nxcp-text-muted);
}
.nxcp-quick-prompts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
}
.nxcp-quick-prompt {
  padding: 6px 12px;
  border: 1px solid var(--nxcp-border-strong);
  border-radius: var(--nxcp-radius-pill);
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
  transition: color var(--nxcp-motion-fast), border-color var(--nxcp-motion-fast);
}
.nxcp-quick-prompt:hover {
  border-color: var(--nxcp-accent);
  color: var(--nxcp-accent);
}
.nxcp-banner {
  padding: 8px 16px;
  font-size: 12.5px;
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text-muted);
  border-bottom: 1px solid var(--nxcp-border);
}
.nxcp-banner[data-tone='error'] { color: var(--nxcp-danger); }
.nxcp-footer-actions {
  padding: 8px 16px;
  border-top: 1px solid var(--nxcp-border);
}
/* Bottom-centre: left 50% with translateX(-50%) is the one place a physical property is the
   point, since centring reads the same in both directions. */
.nxcp-toast-region {
  position: fixed;
  bottom: 24px;
  left: 50%;
  z-index: ${z_index_1.COPILOT_Z_INDEX.overlay};
  display: flex;
  justify-content: center;
  max-width: calc(100vw - 32px);
  transform: translateX(-50%);
  pointer-events: none;
}
.nxcp-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border: 1px solid var(--nxcp-border-strong);
  border-radius: var(--nxcp-radius-pill);
  background: var(--nxcp-surface);
  color: var(--nxcp-text);
  font-size: 12px;
  line-height: 16px;
  box-shadow: var(--nxcp-elev-3);
  pointer-events: auto;
  animation: nxcp-modal-in 0.18s ease-out;
}
.nxcp-toast[data-tone='error'] { border-color: var(--nxcp-danger); }
.nxcp-toast-action {
  padding: 0;
  border: 0;
  background: none;
  color: var(--nxcp-accent);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.nxcp-toast-dismiss {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: none;
  color: var(--nxcp-text-tertiary);
  line-height: 0;
  cursor: pointer;
}
@media (max-width: 640px) {
  /* The card becomes a bottom sheet; !important beats the inline drag width. */
  .nxcp-dock {
    inset-inline: 0;
    bottom: 0;
    width: 100% !important;
    max-width: none;
    height: 92dvh;
    border-inline: 0;
    border-bottom: 0;
    border-radius: 0;
    border-start-start-radius: var(--nxcp-radius-lg);
    border-start-end-radius: var(--nxcp-radius-lg);
  }
  .nxcp-resize { display: none; }
}
@media (max-width: 390px) {
  .nxcp-header,
  .nxcp-footer,
  .nxcp-banner { padding-inline: 10px; }
  .nxcp-footer { gap: 6px 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .nxcp-launcher,
  .nxcp-launcher-halo,
  .nxcp-launcher-label,
  .nxcp-dock,
  .nxcp-threads-popover,
  .nxcp-thread-menu,
  .nxcp-toast,
  .nxcp-icon-button,
  .nxcp-quick-prompt {
    animation: none;
    transition: none;
  }
  .nxcp-launcher-halo { opacity: 0; }
}
.nxcp-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;
exports.COPILOT_CSS = [SHELL_CSS, transcript_1.TRANSCRIPT_CSS, trace_1.TRACE_CSS].join('\n');
function injectCopilotStyles(doc = document) {
    if (doc.getElementById(exports.COPILOT_STYLE_ELEMENT_ID))
        return;
    const style = doc.createElement('style');
    style.id = exports.COPILOT_STYLE_ELEMENT_ID;
    style.textContent = exports.COPILOT_CSS;
    doc.head.appendChild(style);
}
