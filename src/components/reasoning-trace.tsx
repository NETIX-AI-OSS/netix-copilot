// The reasoning trace: plan, specialist cards and tool rows between the user's bubble and the
// answer. This placeholder renders the flat timeline until the trace lands, so the transcript
// can already mount it by name.

import type { RunState } from '../types'
import { PlanTimeline } from './plan-timeline'

export interface ReasoningTraceProps {
  run: RunState
  // Open by default while the run is live; a replayed turn starts collapsed.
  defaultOpen?: boolean
}

export function ReasoningTrace({ run }: ReasoningTraceProps) {
  return <PlanTimeline steps={run.steps} hasPlan={run.hasPlan} />
}
