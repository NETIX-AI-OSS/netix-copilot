import { describe, expect, it } from 'vitest'

import { agentDomain, agentLabel, formatDuration, toolLabel } from '../components/trace-labels'
import { createFallbackTranslate } from '../ui/i18n'

const t = createFallbackTranslate()
// A host catalogue that knows one tool the SDK does not and echoes every other key back.
const hostT = (key: string) => (key === 'copilot.tool.zap_widget' ? 'Zapped the widget' : key)

describe('toolLabel', () => {
  it('prefers the host label map, then the catalogue, then a sentence-cased name', () => {
    expect(
      toolLabel(t, { tools: { data_query_retrieve: 'Pulled history' } }, 'data_query_retrieve'),
    ).toBe('Pulled history')
    expect(toolLabel(t, undefined, 'data_query_retrieve')).toBe('Queried historical data')
    expect(toolLabel(t, undefined, 'ppm_schedule_export')).toBe('Ppm schedule export')
  })

  it('takes a translation the host returned for a key the SDK catalogue lacks', () => {
    expect(toolLabel(hostT, undefined, 'zap_widget')).toBe('Zapped the widget')
    expect(toolLabel(hostT, undefined, 'other_thing')).toBe('Other thing')
  })

  it('flags an approval step', () => {
    expect(toolLabel(t, undefined, 'service_request_create', 'awaiting_approval')).toBe(
      'Create a service request · needs approval',
    )
    expect(toolLabel(t, undefined, 'service_request_create', 'rejected')).toContain(
      'needs approval',
    )
    expect(toolLabel(t, undefined, 'service_request_create', 'ok')).toBe('Create a service request')
  })
})

describe('agentLabel', () => {
  it('resolves both spellings of a specialist through one catalogue key', () => {
    expect(agentLabel(t, undefined, 'call_work_orders_agent')).toBe('Work orders specialist')
    expect(agentLabel(t, undefined, 'WorkOrdersAgent')).toBe('Work orders specialist')
    expect(agentLabel(t, undefined, 'orchestrator')).toBe('Orchestrator')
  })

  it('lets the host override by raw name and title-cases an unknown specialist', () => {
    expect(
      agentLabel(t, { agents: { FacilitiesAgent: 'Building brain' } }, 'FacilitiesAgent'),
    ).toBe('Building brain')
    expect(agentLabel(t, undefined, 'call_energy_audit_agent')).toBe('Energy Audit')
    expect(agentLabel(hostT, undefined, 'EnergyAuditAgent')).toBe('Energy Audit')
  })
})

describe('agentDomain', () => {
  it('puts the CAFM specialists on the CAFM lane and everything else on NETIX', () => {
    expect(agentDomain('work_orders')).toBe('cafm')
    expect(agentDomain('call_complaints_agent')).toBe('cafm')
    expect(agentDomain('CommercialAgent')).toBe('cafm')
    expect(agentDomain('compliance')).toBe('cafm')
    expect(agentDomain('facilities')).toBe('netix')
    expect(agentDomain('tuning_advisor')).toBe('netix')
    expect(agentDomain('orchestrator')).toBe('netix')
  })
})

describe('formatDuration', () => {
  it('shows milliseconds under a second and one decimal above', () => {
    expect(formatDuration(0)).toBe('0 ms')
    expect(formatDuration(820.4)).toBe('820 ms')
    expect(formatDuration(4200)).toBe('4.2 s')
    expect(formatDuration(61_000)).toBe('61.0 s')
  })
})
