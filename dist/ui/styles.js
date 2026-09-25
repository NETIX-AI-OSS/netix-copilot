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
  --nxcp-border: #e6eaf0;
  --nxcp-text: #0f172a;
  --nxcp-text-muted: #475569;
  --nxcp-accent: #1d63e0;
  --nxcp-accent-text: #ffffff;
  /* Derived from the v0.3 tokens, so a host that only sets those (a dark theme included) gets
     coherent values here; a host value set inline on the same element still wins. */
  --nxcp-surface-2: var(--nxcp-surface-muted);
  --nxcp-surface-3: color-mix(in srgb, var(--nxcp-surface-muted) 95%, var(--nxcp-text));
  --nxcp-border-strong: color-mix(in srgb, var(--nxcp-border) 88%, var(--nxcp-text));
  --nxcp-text-tertiary: color-mix(in srgb, var(--nxcp-text-muted) 85%, var(--nxcp-surface));
  --nxcp-accent-subtle: color-mix(in srgb, var(--nxcp-accent) 12%, var(--nxcp-surface));
  --nxcp-domain-cafm: #0e7c86;
  --nxcp-danger: #c8372d;
  --nxcp-success: #1f8a54;
  --nxcp-warning: #b8730a;
  --nxcp-radius: 14px;
  --nxcp-radius-sm: 6px;
  --nxcp-radius-md: 10px;
  --nxcp-radius-lg: 14px;
  --nxcp-radius-xl: 18px;
  --nxcp-radius-pill: 999px;
  --nxcp-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --nxcp-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --nxcp-elev-1: 0 1px 2px rgba(16, 24, 40, 0.06);
  --nxcp-elev-2: 0 4px 12px rgba(16, 24, 40, 0.08);
  --nxcp-elev-3: 0 12px 32px rgba(16, 24, 40, 0.16);
  --nxcp-shadow: var(--nxcp-elev-3);
  --nxcp-focus-ring: 0 0 0 3px color-mix(in srgb, var(--nxcp-accent) 45%, transparent);
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
@keyframes nxcp-shine {
  from { background-position: 160% 0; }
  to { background-position: -60% 0; }
}
@keyframes nxcp-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nxcp-shimmer {
  from { background-position: 100% 0; }
  to { background-position: 0 0; }
}
.nxcp-launcher {
  position: fixed;
  inset-inline-end: 20px;
  bottom: 20px;
  z-index: ${z_index_1.COPILOT_Z_INDEX.launcher};
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 5px;
  border: 0;
  border-radius: 22px;
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  overflow: hidden;
  box-shadow: var(--nxcp-elev-2), 0 0 0 0 color-mix(in srgb, var(--nxcp-accent) 45%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--nxcp-accent-text) 22%, transparent);
  animation: nxcp-modal-in 0.18s ease-out;
  transition: transform 0.16s cubic-bezier(0.2, 0.8, 0.25, 1), box-shadow var(--nxcp-motion-base);
}
/* A slow diagonal sheen, always on but quiet: it reads as "alive", not as a loading state. */
.nxcp-launcher::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 40%,
    color-mix(in srgb, var(--nxcp-accent-text) 30%, transparent) 50%,
    transparent 60%
  );
  background-size: 220% 100%;
  animation: nxcp-shine 4.5s linear infinite;
  pointer-events: none;
}
/* A glow, not a lift: the pill grows a soft accent-tinted halo and holds still. */
.nxcp-launcher:hover {
  box-shadow: var(--nxcp-elev-3), 0 0 0 6px color-mix(in srgb, var(--nxcp-accent) 16%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--nxcp-accent-text) 22%, transparent);
}
.nxcp-launcher:active {
  transform: scale(0.96);
  transition-duration: 0.08s;
}
.nxcp-launcher:focus-visible {
  box-shadow: var(--nxcp-elev-3), var(--nxcp-focus-ring);
}
.nxcp-launcher-tile {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--nxcp-accent-text);
  transition: transform var(--nxcp-motion-base);
}
.nxcp-launcher:hover .nxcp-launcher-tile { transform: rotate(-8deg) scale(1.06); }
.nxcp-launcher:active .nxcp-launcher-tile { transform: none; }
.nxcp-launcher-label {
  position: relative;
  max-width: 0;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  font-size: 13px;
  font-weight: 600;
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
  padding-inline-start: 2px;
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
  inset-inline-end: 20px;
  bottom: 20px;
  z-index: ${z_index_1.COPILOT_Z_INDEX.dock};
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 40px);
  height: min(720px, calc(100dvh - 40px));
  overflow: hidden;
  background: var(--nxcp-surface);
  border: 1px solid color-mix(in srgb, var(--nxcp-border) 70%, transparent);
  border-radius: var(--nxcp-radius-xl);
  box-shadow: var(--nxcp-elev-3);
  animation: nxcp-modal-in 0.18s ease-out;
}
.nxcp-dock > .nxcp-panel {
  flex: 1;
  border-radius: inherit;
}
.nxcp-expanded-layer {
  position: fixed;
  inset: 0;
  z-index: ${z_index_1.COPILOT_Z_INDEX.dock};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}
.nxcp-backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--nxcp-text) 32%, transparent);
  backdrop-filter: blur(3px);
  animation: nxcp-fade-in 0.16s ease-out;
}
.nxcp-expanded {
  position: relative;
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  width: min(1200px, 100%);
  height: min(880px, 100%);
  overflow: hidden;
  /* Transparent so the rail can show the page through its blur; the panel paints its own surface. */
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--nxcp-border) 60%, transparent);
  border-radius: var(--nxcp-radius-xl);
  box-shadow: var(--nxcp-elev-3);
  animation: nxcp-modal-in 0.2s ease-out;
}
.nxcp-expanded-rail {
  min-width: 0;
  min-height: 0;
  padding: 12px 10px;
  background: color-mix(in srgb, var(--nxcp-surface) 78%, transparent);
  -webkit-backdrop-filter: blur(28px) saturate(1.5);
  backdrop-filter: blur(28px) saturate(1.5);
}
.nxcp-expanded > .nxcp-panel { border-radius: 0; }
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
.nxcp-header {
  position: relative;
  z-index: 1;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 0 10px 0 16px;
  box-sizing: border-box;
  background: var(--nxcp-surface);
}
.nxcp-footer {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  min-width: 0;
}
.nxcp-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}
.nxcp-title svg { flex: none; }
.nxcp-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
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
  gap: 2px;
  margin-inline-start: auto;
}
.nxcp-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: var(--nxcp-radius-md);
  background: transparent;
  color: var(--nxcp-text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: color var(--nxcp-motion-fast), background-color var(--nxcp-motion-fast);
}
.nxcp-icon-button:hover:not(:disabled),
.nxcp-icon-button[aria-expanded='true'] {
  background: var(--nxcp-surface-3);
  color: var(--nxcp-text);
}
.nxcp-icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nxcp-icon-button[data-tone='danger'] {
  color: var(--nxcp-danger);
  background: color-mix(in srgb, var(--nxcp-danger) 10%, transparent);
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
  border-radius: var(--nxcp-radius-lg);
  box-shadow: var(--nxcp-elev-3);
  animation: nxcp-modal-in 0.12s ease-out;
}
.nxcp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 16px 16px 24px;
  /* No rules between header, transcript and composer: the transcript fades out at both edges. */
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 28px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 28px), transparent 100%);
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--nxcp-text) 20%, transparent) transparent;
}
.nxcp-body-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 26px;
  width: 100%;
  max-width: 780px;
  margin-inline: auto;
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
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--nxcp-radius-md);
  background: transparent;
  color: var(--nxcp-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--nxcp-motion-fast);
}
.nxcp-history-new:hover { background: color-mix(in srgb, var(--nxcp-text) 7%, transparent); }
.nxcp-history-search {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 0;
  border-radius: var(--nxcp-radius-md);
  background: color-mix(in srgb, var(--nxcp-text) 6%, transparent);
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
.nxcp-history-search:focus-within {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--nxcp-accent) 35%, transparent);
}
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
  padding: 12px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: 0.02em;
  color: var(--nxcp-text-tertiary);
}
.nxcp-history-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.nxcp-thread-row {
  position: relative;
  display: flex;
  flex-direction: column;
}
.nxcp-thread {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--nxcp-radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--nxcp-motion-fast);
}
.nxcp-thread:hover { background: color-mix(in srgb, var(--nxcp-text) 6%, transparent); }
.nxcp-thread[aria-current='true'] {
  background: color-mix(in srgb, var(--nxcp-text) 9%, transparent);
}
.nxcp-thread[aria-current='true'] .nxcp-thread-title { font-weight: 500; }
.nxcp-thread-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--nxcp-text);
}
.nxcp-thread-meta {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: opacity var(--nxcp-motion-fast);
}
/* On hover the row menu takes the meta's place at the end of the line. */
.nxcp-thread-row:hover .nxcp-thread-meta,
.nxcp-thread-row:focus-within .nxcp-thread-meta { opacity: 0; }
.nxcp-thread-meta .nxcp-badge {
  padding: 0 5px;
  border: 0;
  font-size: 10px;
  font-weight: 500;
  background: color-mix(in srgb, var(--nxcp-text) 7%, transparent);
  color: var(--nxcp-text-muted);
}
.nxcp-thread-time {
  font-size: 11px;
  white-space: nowrap;
  color: var(--nxcp-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.nxcp-thread-kebab {
  position: absolute;
  top: 50%;
  inset-inline-end: 4px;
  min-width: 26px;
  height: 26px;
  padding: 0;
  color: var(--nxcp-text-tertiary);
  line-height: 0;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity var(--nxcp-motion-fast);
}
.nxcp-thread-row:hover .nxcp-thread-kebab,
.nxcp-thread-kebab:focus-visible,
.nxcp-thread-kebab[aria-expanded='true'] { opacity: 1; }
@media (hover: none) {
  .nxcp-thread-kebab { opacity: 1; }
}
.nxcp-thread-menu {
  position: absolute;
  top: calc(100% - 2px);
  inset-inline-end: 4px;
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
.nxcp-thread-menu button {
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
.nxcp-thread-menu button:hover { background: var(--nxcp-surface-2); }
.nxcp-thread-menu button[data-tone='danger'] { color: var(--nxcp-danger); }
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
.nxcp-history[data-compact='true'] .nxcp-thread { min-height: 32px; padding-block: 5px; }
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
  padding: 8px 4px 16px;
  box-sizing: border-box;
  text-align: center;
}
.nxcp-empty-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-block-end: 4px;
  border-radius: 14px;
  background: var(--nxcp-accent-subtle);
  color: var(--nxcp-accent);
}
.nxcp-empty-heading {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: -0.01em;
  color: var(--nxcp-text);
}
.nxcp-empty-body {
  margin: 0;
  max-width: 380px;
  text-align: center;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--nxcp-text-muted);
}
.nxcp-quick-prompts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 440px;
  margin-top: 14px;
}
.nxcp-quick-prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-radius: var(--nxcp-radius-lg);
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--nxcp-motion-fast), color var(--nxcp-motion-fast);
}
.nxcp-quick-prompt:hover { background: var(--nxcp-accent-subtle); }
.nxcp-quick-prompt-text { flex: 1; min-width: 0; }
.nxcp-quick-prompt-arrow {
  flex: none;
  color: var(--nxcp-text-tertiary);
  opacity: 0;
  transform: translateX(-3px);
  transition: opacity var(--nxcp-motion-fast), transform var(--nxcp-motion-fast);
}
.nxcp-quick-prompt:hover .nxcp-quick-prompt-arrow,
.nxcp-quick-prompt:focus-visible .nxcp-quick-prompt-arrow {
  opacity: 1;
  transform: none;
  color: var(--nxcp-accent);
}
.nxcp-quick-prompt-arrow:dir(rtl) { transform: scaleX(-1); }
.nxcp-banner {
  padding: 8px 16px;
  font-size: 12.5px;
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text-muted);
  border-bottom: 1px solid var(--nxcp-border);
}
.nxcp-banner[data-tone='error'] { color: var(--nxcp-danger); }
.nxcp-footer-actions {
  display: inline-flex;
  align-items: center;
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
    border-start-start-radius: var(--nxcp-radius-xl);
    border-start-end-radius: var(--nxcp-radius-xl);
  }
  .nxcp-resize { display: none; }
}
@media (max-width: 860px) {
  /* No room for the rail: the sheet fills the screen and threads move back to the popover. */
  .nxcp-expanded-layer { padding: 0; }
  .nxcp-expanded {
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
  }
  .nxcp-expanded-rail { display: none; }
}
@media (min-width: 861px) {
  /* The rail beside the panel already offers the conversations and New chat. */
  .nxcp-panel[data-layout='expanded'] .nxcp-threads-trigger,
  .nxcp-panel[data-layout='expanded'] .nxcp-header-new { display: none; }
}
@media (max-width: 390px) {
  .nxcp-header,
  .nxcp-foot,
  .nxcp-banner { padding-inline: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .nxcp-launcher,
  .nxcp-launcher::before,
  .nxcp-launcher-label,
  .nxcp-dock,
  .nxcp-expanded,
  .nxcp-backdrop,
  .nxcp-thread,
  .nxcp-thread-kebab,
  .nxcp-quick-prompt-arrow,
  .nxcp-threads-popover,
  .nxcp-thread-menu,
  .nxcp-toast,
  .nxcp-icon-button,
  .nxcp-quick-prompt {
    animation: none;
    transition: none;
  }
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
