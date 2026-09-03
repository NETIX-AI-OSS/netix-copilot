// Human labels for the raw ml-engine names the trace renders. Precedence is the host's own
// label map, then the translation catalogue, then a readable form of the raw name, so a tool
// the catalogue has never heard of still reads as words rather than an identifier.

import type { CopilotLabels, TranslateFn } from '../adapters/types'
import { agentKey } from '../runtime/trace-model'
import type { StepStatus } from '../types'
import { COPILOT_STRINGS } from '../ui/i18n'

export type AgentDomain = 'netix' | 'cafm'

const CAFM_AGENTS = new Set(['work_orders', 'commercial', 'compliance', 'complaints'])

// A host's t() returns the key itself for anything it has no translation for, which is the only
// signal available that the catalogue lacks the entry.
function translated(t: TranslateFn, key: string): string | undefined {
  if (key in COPILOT_STRINGS) return t(key)
  const value = t(key)
  return value === key ? undefined : value
}

function sentenceCase(name: string): string {
  const words = name.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function titleCase(name: string): string {
  return name
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

export function toolLabel(
  t: TranslateFn,
  labels: CopilotLabels | undefined,
  tool: string,
  status?: StepStatus,
): string {
  const base = labels?.tools?.[tool] ?? translated(t, `copilot.tool.${tool}`) ?? sentenceCase(tool)
  if (status === 'awaiting_approval' || status === 'rejected') {
    return `${base} · ${t('copilot.tool.needsApproval')}`
  }
  return base
}

export function agentLabel(
  t: TranslateFn,
  labels: CopilotLabels | undefined,
  nameOrTool: string,
): string {
  const key = agentKey(nameOrTool) ?? nameOrTool
  return (
    labels?.agents?.[nameOrTool] ??
    labels?.agents?.[key] ??
    translated(t, `copilot.agent.${key}`) ??
    titleCase(key.replace(/^call_/, '').replace(/_agent$/, ''))
  )
}

export function agentDomain(key: string): AgentDomain {
  return CAFM_AGENTS.has(agentKey(key) ?? key) ? 'cafm' : 'netix'
}

// Durations as the reference draws them: milliseconds under a second, one decimal above.
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}
