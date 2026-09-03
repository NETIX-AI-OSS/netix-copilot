import { describe, expect, it } from 'vitest'

import {
  agentKey,
  agentSteps,
  buildTraceTree,
  countSteps,
  isAgentStep,
  stepElapsedMs,
} from '../runtime/trace-model'
import type { PlanStep } from '../types'

const step = (id: string, extra: Partial<PlanStep> = {}): PlanStep => ({
  id,
  title: id,
  status: 'ok',
  ...extra,
})

describe('trace model', () => {
  it('recognises a specialist delegation by its meta-tool name or an explicit kind', () => {
    expect(isAgentStep(step('a', { tool: 'call_facilities_agent' }))).toBe(true)
    expect(isAgentStep(step('b', { tool: 'data_query_retrieve' }))).toBe(false)
    expect(isAgentStep(step('c', { kind: 'agent' }))).toBe(true)
    expect(isAgentStep(step('d', { kind: 'tool', tool: 'call_asset_agent' }))).toBe(false)
  })

  it('maps both spellings of a specialist onto one key', () => {
    expect(agentKey('call_work_orders_agent')).toBe('work_orders')
    expect(agentKey('WorkOrdersAgent')).toBe('work_orders')
    expect(agentKey('TuningAdvisorAgent')).toBe('tuning_advisor')
    expect(agentKey('FacilitiesAgent')).toBe('facilities')
    expect(agentKey('realtime_data_retrieve')).toBeUndefined()
  })

  it('nests children under their parent in arrival order and keeps orphans visible', () => {
    const steps = [
      step('plan-1', { tool: 'make_plan' }),
      step('call-1', { tool: 'call_facilities_agent' }),
      step('call-2', { tool: 'call_work_orders_agent' }),
      step('t-1', { tool: 'realtime_data_retrieve', parentId: 'call-1' }),
      step('t-2', { tool: 'reactive_work_order_list', parentId: 'call-2' }),
      step('t-3', { tool: 'data_query_retrieve', parentId: 'call-1' }),
      step('t-4', { tool: 'execute_code', parentId: 'missing' }),
    ]
    const tree = buildTraceTree(steps)
    expect(tree.map((n) => n.step.id)).toEqual(['plan-1', 'call-1', 'call-2', 't-4'])
    expect(tree[1]!.children.map((n) => n.step.id)).toEqual(['t-1', 't-3'])
    expect(tree[2]!.children.map((n) => n.step.id)).toEqual(['t-2'])
    expect(countSteps(tree)).toBe(7)
    expect(agentSteps(steps).map((s) => s.id)).toEqual(['call-1', 'call-2'])
  })

  it('keeps a self-referencing step at the top level', () => {
    const tree = buildTraceTree([step('x', { parentId: 'x' })])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.children).toHaveLength(0)
  })

  it('times a step from its reported duration, else its timestamps, else the live clock', () => {
    expect(stepElapsedMs(step('a', { durationMs: 420, startedAt: 0, finishedAt: 9_000 }))).toBe(420)
    expect(stepElapsedMs(step('b', { startedAt: 1_000, finishedAt: 3_500 }))).toBe(2_500)
    expect(stepElapsedMs(step('c', { status: 'running', startedAt: 1_000 }), 1_750)).toBe(750)
    expect(stepElapsedMs(step('d', { status: 'running', startedAt: 1_000 }))).toBeUndefined()
    expect(stepElapsedMs(step('e', { status: 'pending', startedAt: 1_000 }), 5_000)).toBeUndefined()
    expect(stepElapsedMs(step('f'), 5_000)).toBeUndefined()
  })
})
