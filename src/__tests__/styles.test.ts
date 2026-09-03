// What the stylesheet promises hosts: every colour is a token, the new tokens follow the v0.3 ones
// a host already themes, and the rotated chevrons keep their shape under RTL.

import { describe, expect, it } from 'vitest'

import { COPILOT_CSS } from '../ui/styles'

const tokenBlock = COPILOT_CSS.slice(0, COPILOT_CSS.indexOf('}'))

describe('COPILOT_CSS', () => {
  it('derives the widened tokens from the ones a v0.3 theme sets, so dark hosts stay coherent', () => {
    expect(tokenBlock).toMatch(/--nxcp-surface-3: color-mix\(in srgb, var\(--nxcp-surface-muted\)/)
    expect(tokenBlock).toMatch(/--nxcp-border-strong: color-mix\(in srgb, var\(--nxcp-border\)/)
    expect(tokenBlock).toMatch(/--nxcp-text-tertiary: color-mix\(in srgb, var\(--nxcp-text-muted\)/)
    expect(tokenBlock).toMatch(/--nxcp-accent-subtle: color-mix\(in srgb, var\(--nxcp-accent\)/)
    expect(tokenBlock).toMatch(
      /--nxcp-focus-ring: 0 0 0 3px color-mix\(in srgb, var\(--nxcp-accent\)/,
    )
  })

  it('paints nothing outside the token block in a literal brand colour', () => {
    const rules = COPILOT_CSS.slice(tokenBlock.length)
    expect(rules).not.toMatch(/rgba\(29, 99, 224/)
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(rules).toContain(
      '.nxcp-launcher-tile {\n' +
        '  position: relative;\n' +
        '  flex: none;\n' +
        '  display: inline-flex;\n' +
        '  align-items: center;\n' +
        '  justify-content: center;\n' +
        '  width: 34px;\n' +
        '  height: 34px;\n' +
        '  border-radius: 11px;\n' +
        '  background: var(--nxcp-accent-text);\n' +
        '  color: var(--nxcp-accent);\n' +
        '  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nxcp-accent) 18%, transparent);',
    )
  })

  it('draws both chevrons with physical edges, since the square is rotated', () => {
    for (const selector of ['.nxcp-chevron {', '.nxcp-tier-chevron {']) {
      const start = COPILOT_CSS.indexOf(selector)
      const rule = COPILOT_CSS.slice(start, COPILOT_CSS.indexOf('}', start))
      expect(rule).toContain('border-right: 1.5px solid currentColor')
      expect(rule).toContain('border-bottom: 1.5px solid currentColor')
      expect(rule).not.toContain('border-inline-end')
    }
  })

  it('shows the transport as a dot, coloured by transport', () => {
    expect(COPILOT_CSS).toContain('.nxcp-transport-dot {')
    expect(COPILOT_CSS).toContain(".nxcp-transport-dot[data-transport='agentic']")
    expect(COPILOT_CSS).not.toContain('.nxcp-usage-item[data-transport]')
  })

  it('leaves no fallback value on a trace token, since the shell declares them all', () => {
    expect(COPILOT_CSS).not.toMatch(/var\(--nxcp-[\w-]+, /)
  })
})
