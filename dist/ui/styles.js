"use strict";
// Styling ships as one injected stylesheet plus CSS custom properties.
//
// No CSS file to import, no Tailwind classes: viz-ui and cafm-v2-ui are on Tailwind 3.4 while
// prism-ui is on Tailwind 4.3, and a shared package cannot depend on either compiling its class
// names. Every selector is prefixed `nxcp-` and every colour resolves from a variable the theme
// adapter sets, so a host restyles the dock without touching this file.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPILOT_CSS = exports.COPILOT_STYLE_ELEMENT_ID = void 0;
exports.injectCopilotStyles = injectCopilotStyles;
const z_index_1 = require("./z-index");
exports.COPILOT_STYLE_ELEMENT_ID = 'netix-copilot-styles';
exports.COPILOT_CSS = `
.nxcp-root {
  --nxcp-surface: #ffffff;
  --nxcp-surface-muted: #f5f6f8;
  --nxcp-border: #e2e5ea;
  --nxcp-text: #14181f;
  --nxcp-text-muted: #626b7a;
  --nxcp-accent: #2f6df6;
  --nxcp-accent-text: #ffffff;
  --nxcp-danger: #c8372d;
  --nxcp-success: #1f8a54;
  --nxcp-warning: #b8730a;
  --nxcp-radius: 12px;
  --nxcp-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --nxcp-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --nxcp-shadow: 0 12px 40px rgba(16, 24, 40, 0.18);
  color: var(--nxcp-text);
  font-family: var(--nxcp-font);
  font-size: 14px;
  line-height: 1.55;
}
.nxcp-launcher {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: ${z_index_1.COPILOT_Z_INDEX.launcher};
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--nxcp-border);
  border-radius: 999px;
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--nxcp-shadow);
}
.nxcp-launcher:focus-visible,
.nxcp-icon-button:focus-visible,
.nxcp-send:focus-visible {
  outline: 2px solid var(--nxcp-accent);
  outline-offset: 2px;
}
.nxcp-dock {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: ${z_index_1.COPILOT_Z_INDEX.dock};
  display: flex;
  flex-direction: column;
  background: var(--nxcp-surface);
  border-left: 1px solid var(--nxcp-border);
  box-shadow: var(--nxcp-shadow);
}
.nxcp-resize {
  position: absolute;
  top: 0;
  left: -3px;
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
  outline: none;
}
.nxcp-header,
.nxcp-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--nxcp-border);
}
.nxcp-footer {
  border-bottom: 0;
  border-top: 1px solid var(--nxcp-border);
  color: var(--nxcp-text-muted);
  font-size: 12px;
  flex-wrap: wrap;
}
.nxcp-title {
  font-weight: 600;
  margin-right: auto;
}
.nxcp-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--nxcp-text-muted);
  font: inherit;
  cursor: pointer;
}
.nxcp-icon-button:hover:not(:disabled) {
  background: var(--nxcp-surface-muted);
  color: var(--nxcp-text);
}
.nxcp-icon-button:disabled,
.nxcp-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nxcp-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.nxcp-turn {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nxcp-bubble {
  align-self: flex-end;
  max-width: 88%;
  padding: 8px 12px;
  border-radius: var(--nxcp-radius);
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.nxcp-answer {
  overflow-wrap: anywhere;
}
.nxcp-answer p {
  margin: 0 0 8px;
}
.nxcp-answer ul,
.nxcp-answer ol {
  margin: 0 0 8px;
  padding-left: 20px;
}
.nxcp-answer h1,
.nxcp-answer h2,
.nxcp-answer h3 {
  margin: 12px 0 6px;
  font-size: 15px;
  line-height: 1.3;
}
.nxcp-answer blockquote {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 3px solid var(--nxcp-border);
  color: var(--nxcp-text-muted);
}
.nxcp-answer code {
  font-family: var(--nxcp-mono);
  font-size: 12.5px;
  background: var(--nxcp-surface-muted);
  border-radius: 4px;
  padding: 1px 4px;
}
.nxcp-answer pre {
  margin: 0 0 8px;
  padding: 10px;
  border-radius: var(--nxcp-radius);
  background: var(--nxcp-surface-muted);
  overflow-x: auto;
}
.nxcp-answer pre code {
  background: transparent;
  padding: 0;
}
.nxcp-caret {
  display: inline-block;
  width: 7px;
  height: 14px;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--nxcp-accent);
  animation: nxcp-blink 1s steps(2, start) infinite;
}
@keyframes nxcp-blink {
  50% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .nxcp-caret { animation: none; }
}
.nxcp-timeline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius);
  background: var(--nxcp-surface-muted);
}
.nxcp-step {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
}
.nxcp-step-tool {
  font-family: var(--nxcp-mono);
  font-size: 12px;
}
.nxcp-step-args {
  color: var(--nxcp-text-muted);
  overflow-wrap: anywhere;
}
.nxcp-step-duration {
  margin-left: auto;
  color: var(--nxcp-text-muted);
  font-variant-numeric: tabular-nums;
}
.nxcp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--nxcp-text-muted);
  flex: none;
}
.nxcp-dot[data-status='ok'] { background: var(--nxcp-success); }
.nxcp-dot[data-status='error'] { background: var(--nxcp-danger); }
.nxcp-dot[data-status='running'] { background: var(--nxcp-accent); }
.nxcp-dot[data-status='awaiting_approval'] { background: var(--nxcp-warning); }
.nxcp-approval {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--nxcp-warning);
  border-radius: var(--nxcp-radius);
  background: var(--nxcp-surface);
}
.nxcp-approval-actions {
  display: flex;
  gap: 8px;
}
.nxcp-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.nxcp-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border: 1px solid var(--nxcp-border);
  border-radius: 999px;
  background: var(--nxcp-surface-muted);
  color: var(--nxcp-text-muted);
  font-size: 11.5px;
  line-height: 1.7;
  white-space: nowrap;
}
.nxcp-badge[data-tone='tool'] {
  font-family: var(--nxcp-mono);
  font-size: 11px;
}
.nxcp-badge[data-run-status='done'] {
  border-color: var(--nxcp-success);
  color: var(--nxcp-success);
}
.nxcp-badge[data-run-status='error'] {
  border-color: var(--nxcp-danger);
  color: var(--nxcp-danger);
}
.nxcp-badge[data-run-status='streaming'],
.nxcp-badge[data-run-status='queued'] {
  border-color: var(--nxcp-accent);
  color: var(--nxcp-accent);
}
.nxcp-badge[data-run-status='paused'] {
  border-color: var(--nxcp-warning);
  color: var(--nxcp-warning);
}
.nxcp-result {
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius);
  padding: 8px;
  background: var(--nxcp-surface);
}
.nxcp-result-caption {
  font-size: 12.5px;
  color: var(--nxcp-text-muted);
  margin-bottom: 6px;
}
.nxcp-result-scalar {
  margin: 0;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}
/* A wide result scrolls inside its own box; the dock body never scrolls sideways. */
.nxcp-result-scroll {
  overflow-x: auto;
  max-width: 100%;
}
.nxcp-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12.5px;
}
.nxcp-table th,
.nxcp-table td {
  border-bottom: 1px solid var(--nxcp-border);
  padding: 5px 8px;
  text-align: left;
  white-space: nowrap;
}
.nxcp-table th {
  background: var(--nxcp-surface-muted);
  font-weight: 600;
}
.nxcp-result-more {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--nxcp-text-muted);
}
.nxcp-chart {
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius);
  padding: 8px;
}
.nxcp-chart-title {
  font-size: 12.5px;
  color: var(--nxcp-text-muted);
  margin-bottom: 4px;
}
.nxcp-composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 12px 14px;
  border-top: 1px solid var(--nxcp-border);
}
.nxcp-textarea {
  flex: 1;
  min-height: 44px;
  max-height: 180px;
  padding: 10px 12px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius);
  background: var(--nxcp-surface);
  color: var(--nxcp-text);
  font: inherit;
  resize: none;
}
.nxcp-textarea:focus-visible {
  outline: 2px solid var(--nxcp-accent);
  outline-offset: -1px;
}
.nxcp-send {
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--nxcp-radius);
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.nxcp-threads {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-bottom: 1px solid var(--nxcp-border);
  max-height: 40%;
  overflow-y: auto;
}
.nxcp-thread {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.nxcp-thread:hover { background: var(--nxcp-surface-muted); }
.nxcp-thread[aria-current='true'] {
  background: var(--nxcp-surface-muted);
  font-weight: 600;
}
.nxcp-thread-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nxcp-empty {
  color: var(--nxcp-text-muted);
  padding: 8px 10px;
  font-size: 12.5px;
}
.nxcp-banner {
  padding: 8px 14px;
  font-size: 12.5px;
  background: var(--nxcp-surface-muted);
  color: var(--nxcp-text-muted);
  border-bottom: 1px solid var(--nxcp-border);
}
.nxcp-banner[data-tone='error'] {
  color: var(--nxcp-danger);
}
.nxcp-usage-item { white-space: nowrap; }
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
function injectCopilotStyles(doc = document) {
    if (doc.getElementById(exports.COPILOT_STYLE_ELEMENT_ID))
        return;
    const style = doc.createElement('style');
    style.id = exports.COPILOT_STYLE_ELEMENT_ID;
    style.textContent = exports.COPILOT_CSS;
    doc.head.appendChild(style);
}
