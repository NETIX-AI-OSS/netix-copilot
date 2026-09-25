// Transcript styles: user bubble, assistant block, answer, artifacts, approvals, answer actions,
// composer, tier selector and usage footer. Assembled into COPILOT_CSS by ../styles.ts.
// Every selector is prefixed `nxcp-`; every colour resolves from a `--nxcp-*` token declared on
// `.nxcp-root`. Logical properties only, so an RTL host needs no overrides.

export const TRANSCRIPT_CSS = `
.nxcp-turn {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.nxcp-bubble {
  align-self: flex-end;
  max-width: 85%;
  margin: 0;
  padding: 9px 14px;
  border-start-start-radius: 18px;
  border-start-end-radius: 18px;
  border-end-end-radius: 6px;
  border-end-start-radius: 18px;
  background: var(--nxcp-surface-3);
  color: var(--nxcp-text);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.nxcp-assistant {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  width: 100%;
}
.nxcp-assistant-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  line-height: 16px;
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
  font-size: 14px;
  line-height: 1.65;
  color: var(--nxcp-text);
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
.nxcp-answer > :first-child {
  margin-block-start: 0;
}
.nxcp-answer > :last-child,
.nxcp-answer p:last-child {
  margin-block-end: 0;
}
.nxcp-answer p {
  margin: 0 0 10px;
}
.nxcp-answer .nxcp-answer-lede {
  font-size: 15px;
  color: var(--nxcp-text);
}
.nxcp-answer h1,
.nxcp-answer h2,
.nxcp-answer h3 {
  margin: 14px 0 6px;
  color: var(--nxcp-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}
.nxcp-answer h3 {
  font-size: 14px;
}
.nxcp-answer ul,
.nxcp-answer ol {
  margin: 0 0 10px;
  padding-inline-start: 22px;
}
.nxcp-answer ul {
  list-style: disc;
}
.nxcp-answer ol {
  list-style: decimal;
}
.nxcp-answer li + li {
  margin-block-start: 4px;
}
.nxcp-answer li > ul,
.nxcp-answer li > ol {
  margin-block: 0;
  padding-inline-start: 16px;
}
.nxcp-answer strong {
  color: var(--nxcp-text);
  font-weight: 600;
}
.nxcp-answer em {
  font-style: italic;
}
.nxcp-answer a {
  color: var(--nxcp-accent);
  text-decoration: none;
}
.nxcp-answer a:hover {
  text-decoration: underline;
}
.nxcp-answer blockquote {
  margin: 0 0 10px;
  padding-inline-start: 10px;
  border-inline-start: 3px solid var(--nxcp-border);
  color: var(--nxcp-text-muted);
}
.nxcp-answer code {
  font-family: var(--nxcp-mono);
  font-size: 12.5px;
  background: var(--nxcp-surface-2);
  border-radius: 4px;
  padding: 1px 4px;
}
.nxcp-answer pre {
  margin: 0 0 10px;
  padding: 10px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface-2);
  overflow-x: auto;
}
.nxcp-answer pre code {
  background: transparent;
  padding: 0;
  font-size: 12px;
}
.nxcp-answer hr {
  border: 0;
  border-block-start: 1px solid var(--nxcp-border);
  margin: 10px 0;
}
.nxcp-answer-scroll {
  max-width: 100%;
  margin: 0 0 10px;
  overflow-x: auto;
}
.nxcp-answer table {
  width: 100%;
  margin: 0 0 10px;
  border-collapse: collapse;
  font-size: 12.5px;
  line-height: 1.45;
}
.nxcp-answer-scroll > table {
  margin: 0;
}
.nxcp-answer th,
.nxcp-answer td {
  padding: 6px 10px;
  text-align: start;
  vertical-align: top;
}
.nxcp-answer th {
  background: var(--nxcp-surface-2);
  color: var(--nxcp-text);
  font-weight: 600;
}
.nxcp-answer td {
  border-block-start: 1px solid var(--nxcp-border);
}
.nxcp-answer .nxcp-answer-num {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
.nxcp-answer .nxcp-kv {
  display: grid;
  grid-template-columns: fit-content(45%) minmax(0, 1fr);
  column-gap: 14px;
  margin: 0 0 10px;
  padding: 2px 12px;
  list-style: none;
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface-2);
}
.nxcp-answer .nxcp-kv > li {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: baseline;
  margin: 0;
  padding: 6px 0;
  border-block-start: 1px solid var(--nxcp-border);
}
.nxcp-answer .nxcp-kv > li:first-child {
  border-block-start: 0;
}
.nxcp-kv-label {
  font-size: 12px;
  line-height: 1.5;
  color: var(--nxcp-text-muted);
}
.nxcp-answer .nxcp-kv-label strong {
  color: inherit;
}
.nxcp-kv-value {
  min-width: 0;
  color: var(--nxcp-text);
  font-variant-numeric: tabular-nums;
}
/* A host renderer ends in a block, so its caret sits beside it only if that block goes inline. */
.nxcp-answer:has(> .nxcp-caret) > :nth-last-child(2) {
  display: inline;
  margin-block-end: 0;
}
.nxcp-caret {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-inline-start: 4px;
  vertical-align: middle;
  border-radius: 50%;
  background: var(--nxcp-accent);
  animation: nxcp-blink 1s ease-in-out infinite;
}
.nxcp-artifact {
  max-width: 860px;
  min-width: 0;
  padding: 12px 14px;
  border-radius: var(--nxcp-radius-lg);
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
.nxcp-approval-arguments {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--nxcp-text-muted);
}
.nxcp-approval-arguments pre {
  max-width: 100%;
  max-height: 280px;
  margin: 0;
  padding: 8px;
  overflow: auto;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-sm);
  background: var(--nxcp-surface-3);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.nxcp-approval-arguments code {
  font-family: var(--nxcp-mono);
  font-size: 11px;
  color: var(--nxcp-text);
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
  gap: 2px;
  align-items: center;
  flex-wrap: wrap;
  max-width: 860px;
  margin-inline-start: -6px;
}
.nxcp-actions-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--nxcp-radius-md);
  background: transparent;
  color: var(--nxcp-text-tertiary);
  cursor: pointer;
  transition: color var(--nxcp-motion-fast), background-color var(--nxcp-motion-fast);
}
.nxcp-actions-button:hover:not(:disabled) {
  color: var(--nxcp-text);
  background: var(--nxcp-surface-3);
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-inline-start: auto;
  font-size: 11.5px;
  color: var(--nxcp-text-tertiary);
  white-space: nowrap;
}
.nxcp-actions-time { font-variant-numeric: tabular-nums; }
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
  position: relative;
  z-index: 1;
  flex: none;
  container-type: inline-size;
  padding: 0 12px 10px;
  background: var(--nxcp-surface);
}
.nxcp-composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 780px;
  margin-inline: auto;
  padding: 12px 8px 8px 14px;
  border: 1px solid var(--nxcp-border);
  border-radius: 22px;
  background: var(--nxcp-surface);
  box-shadow: var(--nxcp-elev-2);
  cursor: text;
  transition: border-color var(--nxcp-motion-fast), box-shadow var(--nxcp-motion-fast);
}
.nxcp-composer:focus-within {
  border-color: color-mix(in srgb, var(--nxcp-accent) 40%, var(--nxcp-border));
  box-shadow: var(--nxcp-elev-2), 0 0 0 4px color-mix(in srgb, var(--nxcp-accent) 8%, transparent);
}
.nxcp-context-chip {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--nxcp-radius-pill);
  background: color-mix(in srgb, var(--nxcp-text) 7%, transparent);
  color: var(--nxcp-text-muted);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
  cursor: pointer;
}
.nxcp-context-chip[data-state='off'] {
  background: transparent;
  color: var(--nxcp-text-tertiary);
  text-decoration: line-through;
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
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 24px;
  max-height: 180px;
  margin: 0;
  padding: 2px 6px 0 0;
  box-sizing: border-box;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--nxcp-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.55;
  resize: none;
}
.nxcp-textarea:focus-visible {
  /* The composer card draws the focus state (:focus-within); a ring on the box inside it doubles it. */
  outline: none;
  box-shadow: none;
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
.nxcp-composer-toolbar { gap: 4px; }
.nxcp-composer-actions { margin-inline-start: auto; }
.nxcp-send {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--nxcp-accent);
  color: var(--nxcp-accent-text);
  font: inherit;
  cursor: pointer;
  transition: opacity var(--nxcp-motion-fast), transform var(--nxcp-motion-fast);
}
.nxcp-send:hover:not(:disabled) { transform: scale(1.05); }
.nxcp-send[data-busy='true'] {
  background: var(--nxcp-text);
  color: var(--nxcp-surface);
}
.nxcp-send:disabled {
  opacity: .3;
  cursor: not-allowed;
}
.nxcp-send:focus-visible {
  outline: none;
  box-shadow: var(--nxcp-focus-ring);
}
/* Said once, before the first question: a soft card with an info mark. */
.nxcp-disclaimer {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 780px;
  margin: 0 auto 10px;
  padding: 9px 14px;
  box-sizing: border-box;
  border-radius: var(--nxcp-radius-xl);
  background: var(--nxcp-accent-subtle);
  color: var(--nxcp-text-muted);
  font-size: 12px;
  line-height: 16px;
}
.nxcp-disclaimer svg {
  flex: none;
  color: var(--nxcp-accent);
}
/* Host facts (e.g. "Powered by …") on one quiet line under the card. */
.nxcp-compose-foot {
  max-width: 780px;
  margin: 8px auto 0;
  text-align: center;
  font-size: 11px;
  line-height: 14px;
  color: var(--nxcp-text-tertiary);
}
.nxcp-compose-foot .nxcp-footer-actions { display: inline; }
.nxcp-popover-root {
  position: relative;
  min-width: 0;
}
.nxcp-popover {
  position: absolute;
  bottom: calc(100% + 10px);
  inset-inline-start: -4px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: 208px;
  padding: 6px;
  box-sizing: border-box;
  background: var(--nxcp-surface);
  border: 1px solid color-mix(in srgb, var(--nxcp-border) 70%, transparent);
  border-radius: var(--nxcp-radius-lg);
  box-shadow: var(--nxcp-elev-3);
  cursor: default;
  animation: nxcp-modal-in 0.12s ease-out;
}
.nxcp-popover-label {
  display: block;
  padding: 4px 8px 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--nxcp-text-tertiary);
}
.nxcp-popover-note {
  margin: 4px 8px 2px;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--nxcp-text-tertiary);
}
.nxcp-tier-options {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.nxcp-tier-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: var(--nxcp-radius-md);
  background: transparent;
  color: var(--nxcp-text);
  font: inherit;
  font-size: 13px;
  text-align: start;
  cursor: pointer;
}
.nxcp-tier-option:hover:not(:disabled) { background: var(--nxcp-surface-3); }
.nxcp-tier-option[aria-checked='true'] {
  color: var(--nxcp-accent);
  font-weight: 500;
}
.nxcp-tier-option:disabled { cursor: not-allowed; }
.nxcp-tier-option:disabled:not([aria-checked='true']) { opacity: 0.5; }
.nxcp-usage-meter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--nxcp-text-tertiary);
  cursor: pointer;
  transition: background-color var(--nxcp-motion-fast);
}
.nxcp-usage-meter:hover,
.nxcp-usage-meter[aria-expanded='true'] { background: var(--nxcp-surface-3); }
.nxcp-usage-track {
  fill: none;
  stroke: color-mix(in srgb, var(--nxcp-text) 18%, transparent);
  stroke-width: 2.2;
}
.nxcp-usage-fill {
  fill: none;
  stroke: var(--nxcp-accent);
  stroke-width: 2.2;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  transition: stroke-dashoffset var(--nxcp-motion-base);
}
.nxcp-usage-meter[data-level='mid'] .nxcp-usage-fill { stroke: var(--nxcp-warning); }
.nxcp-usage-meter[data-level='high'] .nxcp-usage-fill { stroke: var(--nxcp-danger); }
.nxcp-usage-panel {
  inset-inline-start: auto;
  inset-inline-end: -38px;
  width: 260px;
  padding: 14px;
}
.nxcp-usage-panel .nxcp-popover-label { padding: 0 0 8px; }
.nxcp-usage-context + .nxcp-popover-label { padding-top: 14px; }
.nxcp-usage-panel .nxcp-popover-note { margin: 6px 0 0; }
.nxcp-usage-context-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--nxcp-text);
}
.nxcp-usage-context-head strong {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.nxcp-usage-bar {
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: var(--nxcp-radius-pill);
  background: color-mix(in srgb, var(--nxcp-text) 10%, transparent);
}
.nxcp-usage-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--nxcp-accent);
}
.nxcp-usage-rows {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
}
.nxcp-usage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.5px;
  line-height: 16px;
}
.nxcp-usage-row dt {
  margin: 0;
  color: var(--nxcp-text-muted);
}
.nxcp-usage-row dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nxcp-text);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.nxcp-usage-connection {
  margin-top: 12px;
  padding-top: 12px;
  border-block-start: 1px solid color-mix(in srgb, var(--nxcp-border) 60%, transparent);
  color: var(--nxcp-text-muted);
}
.nxcp-usage-connection-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--nxcp-text);
  font-weight: 500;
}
.nxcp-usage-connection .nxcp-transport-dot { margin-inline-start: 0; }
.nxcp-tier-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 168px;
  height: 28px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--nxcp-radius-pill);
  background: transparent;
  color: var(--nxcp-text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--nxcp-motion-fast), color var(--nxcp-motion-fast);
}
.nxcp-tier-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.nxcp-tier-selector[aria-expanded='true'],
.nxcp-tier-selector:hover {
  background: var(--nxcp-surface-3);
  color: var(--nxcp-text);
}
.nxcp-tier-selector:has(.nxcp-tier-select:focus-visible) {
  background: var(--nxcp-surface-3);
  color: var(--nxcp-text);
}
/* The pill shows focus itself; the select inside it must not draw a second ring. */
.nxcp-tier-select:focus-visible {
  outline: none;
  box-shadow: none;
}
.nxcp-tier-orb {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  box-sizing: border-box;
  border: 2.5px solid color-mix(in srgb, var(--nxcp-text-muted) 40%, transparent);
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
  font-weight: 500;
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
  .nxcp-compose-shell { padding-inline: 8px; }
  .nxcp-usage-panel { width: min(260px, calc(100vw - 32px)); }
  .nxcp-tier-selector { padding-inline: 7px; max-width: 148px; }
  .nxcp-tier-select { max-width: 102px; }
}
@media (prefers-reduced-motion: reduce) {
  .nxcp-caret { animation: none; }
  .nxcp-actions-button,
  .nxcp-usage-meter,
  .nxcp-usage-fill,
  .nxcp-send,
  .nxcp-composer,
  .nxcp-tier-selector { transition: none; }
}
`
