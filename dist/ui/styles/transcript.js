"use strict";
// Transcript styles: user bubble, assistant block, answer, artifacts, approvals, answer actions,
// composer, tier selector and usage footer. Assembled into COPILOT_CSS by ../styles.ts.
// Every selector is prefixed `nxcp-`; every colour resolves from a `--nxcp-*` token declared on
// `.nxcp-root`. Logical properties only, so an RTL host needs no overrides.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSCRIPT_CSS = void 0;
exports.TRANSCRIPT_CSS = `
.nxcp-turn {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.nxcp-bubble {
  align-self: flex-end;
  max-width: 78%;
  margin: 0;
  padding: 10px 14px;
  border-start-start-radius: 14px;
  border-start-end-radius: 14px;
  border-end-end-radius: 4px;
  border-end-start-radius: 14px;
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.nxcp-assistant {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
}
.nxcp-assistant-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  font-size: 12px;
  line-height: 16px;
}
.nxcp-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
}
.nxcp-assistant-name {
  font-weight: 700;
  color: var(--nxcp-text);
}
.nxcp-assistant-time {
  color: var(--nxcp-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.nxcp-assistant-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--nxcp-radius-pill);
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: .02em;
  white-space: nowrap;
}
.nxcp-assistant-chip[data-tone='tier'] {
  background: var(--nxcp-accent-subtle);
  color: var(--nxcp-accent);
}
.nxcp-assistant-chip[data-tone='warning'] {
  background: color-mix(in srgb, var(--nxcp-warning) 14%, transparent);
  color: var(--nxcp-warning);
}
.nxcp-answer {
  max-width: 860px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--nxcp-text-muted);
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
.nxcp-answer p {
  margin: 0 0 8px;
}
.nxcp-answer p:last-child {
  margin-block-end: 0;
}
.nxcp-answer strong {
  color: var(--nxcp-text);
}
.nxcp-answer a {
  color: var(--nxcp-accent);
  text-decoration: none;
}
.nxcp-answer a:hover {
  text-decoration: underline;
}
.nxcp-answer ul,
.nxcp-answer ol {
  margin: 0 0 8px;
  padding-inline-start: 20px;
}
.nxcp-answer h1,
.nxcp-answer h2,
.nxcp-answer h3 {
  margin: 12px 0 6px;
  color: var(--nxcp-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}
.nxcp-answer blockquote {
  margin: 0 0 8px;
  padding-inline-start: 10px;
  border-inline-start: 3px solid var(--nxcp-border);
  color: var(--nxcp-text-tertiary);
}
.nxcp-answer code {
  font-family: var(--nxcp-mono);
  font-size: 12px;
  background: var(--nxcp-surface-2);
  border-radius: 4px;
  padding: 1px 4px;
}
.nxcp-answer pre {
  margin: 0 0 8px;
  padding: 10px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface-2);
  overflow-x: auto;
}
.nxcp-answer pre code {
  background: transparent;
  padding: 0;
}
.nxcp-answer hr {
  border: 0;
  border-block-start: 1px solid var(--nxcp-border);
  margin: 8px 0;
}
/* A host renderer ends in a block, so its caret sits beside it only if that block goes inline. */
.nxcp-answer:has(> .nxcp-caret) > :nth-last-child(2) {
  display: inline;
  margin-block-end: 0;
}
.nxcp-caret {
  display: inline-block;
  width: 7px;
  height: 13px;
  margin-inline-start: 2px;
  vertical-align: text-bottom;
  background: var(--nxcp-accent);
  animation: nxcp-blink .9s step-end infinite;
}
.nxcp-artifact {
  max-width: 860px;
  min-width: 0;
  padding: 12px 13px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface-2);
}
.nxcp-artifact-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-block-end: 9px;
  font-size: 12px;
  line-height: 16px;
}
.nxcp-artifact-title {
  font-weight: 700;
  color: var(--nxcp-text);
}
.nxcp-artifact-sub {
  color: var(--nxcp-text-tertiary);
}
.nxcp-chart {
  margin: 0;
  min-width: 0;
}
.nxcp-result {
  min-width: 0;
}
.nxcp-result-scalar {
  margin: 0;
  font-family: var(--nxcp-mono);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--nxcp-text);
}
.nxcp-result-scroll {
  overflow-x: auto;
  max-width: 100%;
}
.nxcp-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 11.5px;
}
.nxcp-table th,
.nxcp-table td {
  padding: 7px 6px;
  text-align: start;
  white-space: nowrap;
  border-block-start: 1px solid var(--nxcp-border);
}
.nxcp-table th {
  border-block-start: 0;
  padding-block-end: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--nxcp-text-tertiary);
}
.nxcp-table td {
  font-family: var(--nxcp-mono);
  font-variant-numeric: tabular-nums;
  color: var(--nxcp-text-muted);
}
.nxcp-result-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-block-start: 8px;
}
.nxcp-result-more {
  margin: 0;
  font-size: 11.5px;
  color: var(--nxcp-text-tertiary);
}
.nxcp-result-export {
  margin-inline-start: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--nxcp-accent);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.nxcp-result-export:hover {
  text-decoration: underline;
}
.nxcp-approval {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 860px;
  padding: 12px 13px;
  border: 1px solid var(--nxcp-warning);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface-2);
}
.nxcp-approval-head {
  display: flex;
  gap: 9px;
  align-items: flex-start;
}
.nxcp-approval-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--nxcp-warning) 14%, transparent);
  color: var(--nxcp-warning);
}
.nxcp-approval-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.nxcp-approval-title {
  font-size: 13px;
  color: var(--nxcp-text);
}
.nxcp-approval-args {
  font-family: var(--nxcp-mono);
  font-size: 11px;
  color: var(--nxcp-text-tertiary);
  overflow-wrap: anywhere;
}
.nxcp-approval-detail {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--nxcp-text-muted);
}
.nxcp-approval-actions {
  display: flex;
  gap: 8px;
}
.nxcp-approval-button {
  padding: 7px 14px;
  border: 1px solid var(--nxcp-accent);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.nxcp-approval-button[data-variant='reject'] {
  border-color: var(--nxcp-border-strong);
  background: transparent;
  color: var(--nxcp-text);
}
.nxcp-approval-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.nxcp-approval-button:focus-visible {
  outline: none;
  box-shadow: var(--nxcp-focus-ring);
}
.nxcp-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  max-width: 860px;
}
.nxcp-actions-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-sm);
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text-tertiary);
  cursor: pointer;
  transition: color var(--nxcp-motion-fast), border-color var(--nxcp-motion-fast);
}
.nxcp-actions-button:hover:not(:disabled) {
  color: var(--nxcp-text);
  border-color: var(--nxcp-border-strong);
}
.nxcp-actions-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.nxcp-actions-button:focus-visible {
  outline: none;
  box-shadow: var(--nxcp-focus-ring);
}
.nxcp-actions-caption {
  margin-inline-start: auto;
  font-size: 12px;
  color: var(--nxcp-text-tertiary);
  white-space: nowrap;
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
  padding: 2px 8px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-pill);
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  white-space: nowrap;
}
.nxcp-badge[data-tone='tool'] {
  font-family: var(--nxcp-mono);
  font-weight: 400;
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
.nxcp-timeline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius);
  background: var(--nxcp-surface-2);
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
  margin-inline-start: auto;
  color: var(--nxcp-text-muted);
  font-variant-numeric: tabular-nums;
}
.nxcp-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--nxcp-text-muted);
}
.nxcp-dot[data-status='ok'] { background: var(--nxcp-success); }
.nxcp-dot[data-status='error'] { background: var(--nxcp-danger); }
.nxcp-dot[data-status='running'] { background: var(--nxcp-accent); }
.nxcp-dot[data-status='awaiting_approval'] { background: var(--nxcp-warning); }
.nxcp-compose-shell {
  padding: 12px 16px 10px;
  border-block-start: 1px solid var(--nxcp-border);
  background: var(--nxcp-surface);
}
.nxcp-composer {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid var(--nxcp-border-strong);
  border-radius: var(--nxcp-radius-lg);
  background: var(--nxcp-surface-2);
}
.nxcp-composer:focus-within {
  border-color: var(--nxcp-accent);
}
.nxcp-context-chip {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  align-self: center;
  min-width: 0;
  max-width: 45%;
  margin-block-end: 2px;
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: var(--nxcp-radius-pill);
  background: var(--nxcp-surface-3);
  color: var(--nxcp-text);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  letter-spacing: .02em;
  white-space: nowrap;
  cursor: pointer;
}
.nxcp-context-chip[data-state='off'] {
  border-style: dashed;
  border-color: var(--nxcp-border-strong);
  background: transparent;
  color: var(--nxcp-text-tertiary);
}
.nxcp-context-chip:focus-visible {
  outline: none;
  box-shadow: var(--nxcp-focus-ring);
}
.nxcp-context-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  unicode-bidi: isolate;
}
.nxcp-textarea {
  flex: 1 1 140px;
  min-width: 0;
  min-height: 20px;
  max-height: 120px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--nxcp-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
}
.nxcp-textarea::placeholder {
  color: var(--nxcp-text-tertiary);
}
.nxcp-composer-toolbar,
.nxcp-composer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.nxcp-composer-toolbar {
  margin-inline-start: auto;
}
.nxcp-send {
  flex: none;
  padding: 8px 15px;
  border: 0;
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.nxcp-send[data-busy='true'] {
  background: var(--nxcp-surface-3);
  color: var(--nxcp-text);
}
.nxcp-send:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.nxcp-send:focus-visible {
  outline: none;
  box-shadow: var(--nxcp-focus-ring);
}
.nxcp-composer-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-block-start: 6px;
  font-size: 10.5px;
  line-height: 16px;
  color: var(--nxcp-text-tertiary);
}
.nxcp-tier-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 168px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--nxcp-radius-pill);
  background: transparent;
  color: var(--nxcp-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--nxcp-motion-fast), color var(--nxcp-motion-fast);
}
.nxcp-tier-selector:hover {
  background: var(--nxcp-surface-3);
  color: var(--nxcp-text);
}
.nxcp-tier-selector:has(.nxcp-tier-select:focus-visible) {
  box-shadow: var(--nxcp-focus-ring);
}
.nxcp-tier-orb {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 3px solid color-mix(in srgb, var(--nxcp-text-muted) 45%, transparent);
  border-inline-end-color: var(--nxcp-accent);
  border-radius: 50%;
}
.nxcp-tier-select {
  min-width: 0;
  max-width: 118px;
  appearance: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-overflow: ellipsis;
}
.nxcp-tier-chevron {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  /* Physical edges on purpose: the square is rotated, so a logical edge would point the chevron
     sideways under RTL. */
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
}
.nxcp-tier-selector[data-locked='true'] {
  opacity: .72;
  cursor: not-allowed;
}
.nxcp-tier-selector[data-locked='true'] .nxcp-tier-orb {
  border-color: color-mix(in srgb, var(--nxcp-text-muted) 55%, transparent);
  border-block-start-color: var(--nxcp-accent);
}
.nxcp-tier-select:disabled {
  cursor: not-allowed;
  opacity: 1;
}
.nxcp-usage-item {
  font-size: 11px;
  color: var(--nxcp-text-tertiary);
  white-space: nowrap;
}
.nxcp-transport-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-inline-start: auto;
  border-radius: 50%;
  background: var(--nxcp-success);
}
.nxcp-transport-dot[data-transport='agentic'] {
  background: var(--nxcp-warning);
}
@media (max-width: 390px) {
  .nxcp-compose-shell { padding-inline: 9px; }
  .nxcp-tier-selector { padding-inline: 7px; max-width: 148px; }
  .nxcp-tier-select { max-width: 102px; }
}
@media (prefers-reduced-motion: reduce) {
  .nxcp-caret { animation: none; }
  .nxcp-actions-button,
  .nxcp-tier-selector { transition: none; }
}
`;
