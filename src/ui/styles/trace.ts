// Reasoning trace styles: the collapsible trace card, plan line, agent cards, step rows and their
// status glyphs. Assembled into COPILOT_CSS by ../styles.ts. Same rules as transcript.ts: `nxcp-`
// prefix, `--nxcp-*` tokens only, logical properties only, motion gated by reduced-motion.
//
// Sizes are the reference's: 12 px header ring with a 2 px brand border, 11 px row glyphs, 5 px
// thinking dots, 10 px mono durations.

export const TRACE_CSS = `
.nxcp-trace {
  container-type: inline-size;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface-2);
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
}
.nxcp-trace-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  color: var(--nxcp-text-muted);
  font: inherit;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}
.nxcp-trace-toggle:focus-visible,
.nxcp-row-head:focus-visible,
.nxcp-row-raw-toggle:focus-visible {
  outline: 2px solid var(--nxcp-accent);
  outline-offset: -2px;
}
.nxcp-trace-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nxcp-trace-chip {
  flex: none;
  padding: 0 6px;
  border: 1px solid var(--nxcp-border);
  border-radius: var(--nxcp-radius-pill);
  color: var(--nxcp-text-tertiary);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 15px;
  white-space: nowrap;
}
.nxcp-trace-elapsed,
.nxcp-row-duration,
.nxcp-agent-duration {
  flex: none;
  margin-inline-start: auto;
  font-family: var(--nxcp-mono);
  font-size: 10px;
  font-weight: 400;
  color: var(--nxcp-text-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.nxcp-chevron {
  flex: none;
  width: 7px;
  height: 7px;
  margin-inline-start: 4px;
  /* Physical edges on purpose: the square is rotated, so a logical edge would point the chevron
     sideways under RTL. */
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  color: var(--nxcp-text-tertiary);
  transform: rotate(45deg) translateY(-2px);
  transition: transform var(--nxcp-motion-fast);
}
/* The header label fills the row, so the elapsed figure needs no auto margin of its own. */
.nxcp-trace-elapsed { margin-inline-start: 0; }
[aria-expanded='true'] > .nxcp-chevron { transform: rotate(-135deg) translateY(-1px); }
.nxcp-trace-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px 12px;
  border-top: 1px solid var(--nxcp-border);
}
/* Author display rules beat the UA's [hidden], so the collapse must be restated here. */
.nxcp-trace-body[hidden],
.nxcp-row-detail[hidden] { display: none; }
.nxcp-trace-plan {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--nxcp-text-muted);
}
.nxcp-trace-plan-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--nxcp-text-tertiary);
}
.nxcp-trace-plan-reasoning { margin: 0; overflow-wrap: anywhere; }
.nxcp-trace-plan-lines {
  margin: 0;
  padding-inline-start: 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nxcp-trace-nodes {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
@container (min-width: 560px) {
  .nxcp-trace-nodes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nxcp-trace-node[data-kind='tool'] { grid-column: 1 / -1; }
  .nxcp-agent .nxcp-trace-nodes { grid-template-columns: minmax(0, 1fr); }
}
.nxcp-row { min-width: 0; }
.nxcp-row-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 2px 4px;
  border: 0;
  border-radius: var(--nxcp-radius-sm);
  background: transparent;
  color: var(--nxcp-text-muted);
  font: inherit;
  text-align: start;
}
button.nxcp-row-head { cursor: pointer; }
button.nxcp-row-head:hover { background: var(--nxcp-surface-3); }
.nxcp-row-head > .nxcp-glyph { margin-top: 2px; }
.nxcp-row-label { flex: none; max-width: 60%; overflow-wrap: anywhere; }
.nxcp-row-args {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--nxcp-mono);
  font-size: 10.5px;
  color: var(--nxcp-text-tertiary);
}
.nxcp-row-expires {
  flex: none;
  color: var(--nxcp-warning);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.nxcp-row[data-status='running'] > .nxcp-row-head {
  animation: nxcp-trace-pulse 1.6s ease-in-out infinite;
}
.nxcp-row[data-status='awaiting_approval'] > .nxcp-row-head {
  background: color-mix(in srgb, var(--nxcp-warning) 12%, transparent);
  color: var(--nxcp-text);
}
.nxcp-row-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-inline-start: 24px;
  padding: 4px 0 2px;
  color: var(--nxcp-text-muted);
}
.nxcp-row-detail-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.nxcp-row-raw-toggle {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--nxcp-accent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.nxcp-row-raw {
  max-height: 240px;
  margin: 0;
  padding: 8px;
  overflow: auto;
  border-radius: var(--nxcp-radius-sm);
  background: var(--nxcp-surface-3);
  font-family: var(--nxcp-mono);
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.nxcp-row > .nxcp-trace-nodes { margin-inline-start: 20px; margin-top: 4px; }
.nxcp-agent {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--nxcp-border);
  border-inline-start: 3px solid var(--nxcp-accent);
  border-radius: var(--nxcp-radius-md);
  background: var(--nxcp-surface);
}
.nxcp-agent[data-domain='cafm'] { border-inline-start-color: var(--nxcp-domain-cafm); }
.nxcp-agent-head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.nxcp-agent-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  color: var(--nxcp-text);
}
.nxcp-agent-domain {
  flex: none;
  font-size: 10.5px;
  color: var(--nxcp-text-tertiary);
}
.nxcp-agent-task {
  margin: 0;
  font-style: italic;
  color: var(--nxcp-text-muted);
  overflow-wrap: anywhere;
}
.nxcp-agent-feedback { margin: 0; color: var(--nxcp-text-muted); overflow-wrap: anywhere; }
.nxcp-agent-feedback strong { color: var(--nxcp-text); }
.nxcp-glyph {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--nxcp-text-tertiary);
}
.nxcp-glyph svg { display: block; width: 100%; height: 100%; }
.nxcp-glyph[data-glyph='tick'] { color: var(--nxcp-success); }
.nxcp-glyph[data-glyph='cross'] { color: var(--nxcp-danger); }
.nxcp-glyph[data-glyph='shield'] { color: var(--nxcp-warning); }
.nxcp-glyph[data-glyph='ring'] {
  border: 2px solid var(--nxcp-accent);
  border-top-color: transparent;
  border-radius: 50%;
  box-sizing: border-box;
  animation: nxcp-spin 0.8s linear infinite;
}
.nxcp-glyph[data-glyph='dots'] { gap: 4px; }
.nxcp-glyph-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: nxcp-dot 1s infinite;
}
.nxcp-glyph-dot:nth-child(2) { animation-delay: 0.2s; }
.nxcp-glyph-dot:nth-child(3) { animation-delay: 0.4s; }
.nxcp-glyph-stop {
  width: 70%;
  height: 70%;
  border-radius: 2px;
  background: currentColor;
}
.nxcp-trace-toggle > .nxcp-glyph[data-glyph='tick'] { color: var(--nxcp-text-tertiary); }
@keyframes nxcp-spin {
  to { transform: rotate(360deg); }
}
@keyframes nxcp-dot {
  0%, 80%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
}
@keyframes nxcp-trace-pulse {
  50% { opacity: 0.55; }
}
@media (prefers-reduced-motion: reduce) {
  .nxcp-glyph[data-glyph='ring'],
  .nxcp-glyph-dot,
  .nxcp-row[data-status='running'] > .nxcp-row-head { animation: none; }
  .nxcp-chevron { transition: none; }
}
`
