// The legacy flat view is still exported, so its class names must still have rules.

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CopilotProvider } from '../adapters/context'
import { PlanTimeline } from '../components/plan-timeline'
import type { CopilotTransport } from '../transport/types'
import { COPILOT_CSS } from '../ui/styles'
import { testAdapters } from './helpers'

const transport: CopilotTransport = {
  name: 'sse',
  createTurn: async () => ({ turnId: '1' }),
  consumeRun: async () => undefined,
  cancelTurn: async () => undefined,
  respondToApproval: async () => undefined,
  listThreads: async () => [],
}

describe('PlanTimeline', () => {
  it('renders the flat rows with a status dot and the shared duration format', () => {
    render(
      <CopilotProvider
        config={{ baseUrl: 'https://x' }}
        adapters={testAdapters()}
        transport={transport}
      >
        <PlanTimeline
          hasPlan
          steps={[
            { id: 's1', title: 'x', tool: 'realtime_data_retrieve', status: 'ok', durationMs: 210 },
            { id: 's2', title: 'y', tool: 'execute_code', status: 'running', durationMs: 1500 },
          ]}
        />
      </CopilotProvider>,
    )
    const rows = document.querySelectorAll('.nxcp-timeline .nxcp-step')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.querySelector('.nxcp-dot')?.getAttribute('data-status')).toBe('ok')
    expect(rows[0]?.querySelector('.nxcp-step-tool')?.textContent).toBe('realtime_data_retrieve')
    expect(rows[0]?.querySelector('.nxcp-step-duration')?.textContent).toBe('210 ms')
    expect(rows[1]?.querySelector('.nxcp-step-duration')?.textContent).toBe('1.5 s')
  })

  it('keeps a rule for every class it emits', () => {
    for (const selector of [
      '.nxcp-timeline {',
      '.nxcp-step {',
      '.nxcp-step-tool {',
      '.nxcp-step-args {',
      '.nxcp-step-duration {',
      '.nxcp-dot {',
      ".nxcp-dot[data-status='ok']",
      ".nxcp-dot[data-status='error']",
      ".nxcp-dot[data-status='running']",
      ".nxcp-dot[data-status='awaiting_approval']",
    ]) {
      expect(COPILOT_CSS).toContain(selector)
    }
  })
})
