import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { CopilotProvider } from '../adapters/context'
import { AgentCard } from '../components/agent-card'
import type { CopilotTransport } from '../transport/types'
import type { PlanStep } from '../types'
import { testAdapters } from './helpers'

const transport: CopilotTransport = {
  name: 'agentic',
  createTurn: async () => ({ turnId: 't1' }),
  consumeRun: () => new Promise<void>(() => undefined),
  cancelTurn: async () => undefined,
  respondToApproval: async () => undefined,
  listThreads: async () => [],
}

function mount(children: ReactNode) {
  return render(
    <CopilotProvider
      config={{ baseUrl: 'https://x' }}
      adapters={testAdapters()}
      transport={transport}
    >
      {children}
    </CopilotProvider>,
  )
}

const step = (extra: Partial<PlanStep>): PlanStep => ({
  id: 'call-1',
  title: 'call_facilities_agent',
  tool: 'call_facilities_agent',
  status: 'running',
  ...extra,
})

describe('AgentCard', () => {
  it('names the specialist, its domain and the task the orchestrator gave it', () => {
    mount(<AgentCard step={step({ task: 'Retrieve current readings for AHU-01' })} />)
    const card = screen.getByRole('region', { name: 'Facilities specialist' })
    expect(card.dataset.domain).toBe('netix')
    expect(card.querySelector('.nxcp-agent-domain')?.textContent).toBe('NETIX.AI')
    expect(card.querySelector('.nxcp-agent-task')?.textContent).toBe(
      'Task: Retrieve current readings for AHU-01',
    )
    expect(card.querySelector('.nxcp-glyph')?.dataset.glyph).toBe('ring')
    expect(card.textContent).toContain('Running')
  })

  it('puts a CAFM specialist on the CAFM lane and reads the name from the class spelling', () => {
    mount(<AgentCard step={step({ tool: undefined, kind: 'agent', agent: 'WorkOrdersAgent' })} />)
    const card = screen.getByRole('region', { name: 'Work orders specialist' })
    expect(card.dataset.domain).toBe('cafm')
    expect(card.querySelector('.nxcp-agent-domain')?.textContent).toBe('CAFM AI')
  })

  it('shows a re-invocation as refining with the feedback, and the reported duration', () => {
    mount(
      <AgentCard
        step={step({ status: 'ok', feedback: 'Include the standby unit too', durationMs: 3400 })}
      />,
    )
    expect(screen.getByText('Refining').closest('p')?.textContent).toBe(
      'Refining · Include the standby unit too',
    )
    expect(document.querySelector('.nxcp-agent-duration')?.textContent).toBe('3.4 s')
    expect(document.querySelector('.nxcp-glyph')?.dataset.glyph).toBe('tick')
  })

  it('counts a live duration from the shared clock and renders nested rows it is given', () => {
    mount(
      <AgentCard step={step({ startedAt: 10_000 })} nowMs={12_500}>
        <ol className='nested'>
          <li>child</li>
        </ol>
      </AgentCard>,
    )
    expect(document.querySelector('.nxcp-agent-duration')?.textContent).toBe('2.5 s')
    expect(document.querySelector('.nxcp-agent .nested')?.textContent).toBe('child')
  })
})
