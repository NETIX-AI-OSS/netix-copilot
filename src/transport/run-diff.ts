// Turns successive snapshots of one stored run into the streaming event vocabulary.
// Shared, because two ml-engine resources answer with the same columns: AgenticMLRequest and ConversationTurn.

import type { EnvelopedEvent, JsonObject } from '../types'
import type { CopilotRunRow } from './transcript'
import {
  AGENTIC_STATUS,
  logSteps,
  mapUsage,
  planSteps,
  readPlanOutput,
  readRunSummary,
} from './transcript'

// A polled run row, plus the two ids that point at the copilot-turn row behind it.
export interface RunSnapshot extends CopilotRunRow {
  turn_id?: number | string | null
  conversation_id?: number | string | null
}

// How much of the snapshot has already become events, since every poll returns the whole run.
export interface RunCursor {
  textLength: number
  logCount: number
  planEmitted: boolean
  chartEmitted: boolean
  usageSignature: string
  runStarted: boolean
  queuedEmitted: boolean
}

const CURSOR_PREFIX = 'agentic'

export function encodeCursor(cursor: RunCursor): string {
  const flags =
    (cursor.planEmitted ? 'p' : '-') +
    (cursor.chartEmitted ? 'c' : '-') +
    (cursor.runStarted ? 'r' : '-') +
    (cursor.queuedEmitted ? 'q' : '-')
  return [
    CURSOR_PREFIX,
    cursor.textLength,
    cursor.logCount,
    flags,
    encodeURIComponent(cursor.usageSignature),
  ].join(':')
}

export function decodeCursor(raw: string | undefined): RunCursor {
  const empty: RunCursor = {
    textLength: 0,
    logCount: 0,
    planEmitted: false,
    chartEmitted: false,
    usageSignature: '',
    runStarted: false,
    queuedEmitted: false,
  }
  if (raw === undefined) return empty
  const parts = raw.split(':')
  if (parts[0] !== CURSOR_PREFIX || parts.length < 4) return empty
  const textLength = Number(parts[1])
  const logCount = Number(parts[2])
  const flags = parts[3] ?? ''
  return {
    textLength: Number.isFinite(textLength) ? textLength : 0,
    logCount: Number.isFinite(logCount) ? logCount : 0,
    planEmitted: flags.includes('p'),
    chartEmitted: flags.includes('c'),
    runStarted: flags.includes('r'),
    queuedEmitted: flags.includes('q'),
    usageSignature: decodeURIComponent(parts[4] ?? ''),
  }
}

export function isTerminalStatus(status: number | undefined): boolean {
  return (
    status === AGENTIC_STATUS.COMPLETED ||
    status === AGENTIC_STATUS.ERRORED ||
    status === AGENTIC_STATUS.CANCELLED
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let index = 0
  while (index < limit && a.charCodeAt(index) === b.charCodeAt(index)) index += 1
  return index
}

function usageSignature(usage: Record<string, unknown> | null | undefined): string {
  if (!usage) return ''
  return JSON.stringify(usage)
}

// Turn one snapshot into the events it implies, advancing the cursor in place.
export function diffRunSnapshot(
  snapshot: RunSnapshot,
  cursor: RunCursor,
  turnId: string,
): EnvelopedEvent[] {
  const events: EnvelopedEvent[] = []
  const emit = (event: EnvelopedEvent['event']): void => {
    events.push({ event, id: encodeCursor(cursor) })
  }

  if (!cursor.runStarted) {
    cursor.runStarted = true
    const modelTier =
      snapshot.model_tier === 'base' ||
      snapshot.model_tier === 'high' ||
      snapshot.model_tier === 'max'
        ? snapshot.model_tier
        : undefined
    emit({
      type: 'run_started',
      turnId,
      ...(snapshot.model ? { model: snapshot.model } : {}),
      ...(modelTier ? { modelTier } : {}),
    })
  }

  if (snapshot.status === AGENTIC_STATUS.PENDING && !cursor.queuedEmitted) {
    cursor.queuedEmitted = true
    emit({ type: 'queued' })
  }

  const plan = Array.isArray(snapshot.plan) ? snapshot.plan : []
  if (!cursor.planEmitted && plan.length > 0) {
    cursor.planEmitted = true
    // A plan_trace carries executed steps; a plan of free strings is shown as lines.
    const lines = plan.filter((line): line is string => typeof line === 'string')
    emit({ type: 'plan', steps: planSteps(plan), ...(lines.length > 0 ? { lines } : {}) })
  }

  const log = Array.isArray(snapshot.execution_log) ? snapshot.execution_log : []
  // Polling only ever sees finished tool calls, so the timeline gets the completed form, nested
  // the same way a stored row rebuilds.
  for (let index = cursor.logCount; index < log.length; index += 1) {
    const entry = log[index]
    if (!isRecord(entry)) continue
    const planned = readPlanOutput(entry)
    if (planned !== undefined) {
      emit({ type: 'plan', steps: [], ...planned })
      continue
    }
    for (const step of logSteps(entry, index)) emit({ type: 'step_result', step })
  }
  cursor.logCount = log.length

  const text = typeof snapshot.response_text === 'string' ? snapshot.response_text : ''
  // The snapshot carries the whole answer every time, so only what is new goes out.
  if (text.length > cursor.textLength) {
    const seen = text.slice(0, cursor.textLength)
    const from =
      seen === text.slice(0, seen.length) ? cursor.textLength : commonPrefixLength(seen, text)
    cursor.textLength = text.length
    emit({ type: 'message_delta', text: text.slice(from) })
  }

  if (
    !cursor.chartEmitted &&
    snapshot.chart_available === true &&
    isRecord(snapshot.chart_config)
  ) {
    if (Object.keys(snapshot.chart_config).length > 0) {
      cursor.chartEmitted = true
      emit({ type: 'chart', option: snapshot.chart_config as JsonObject })
    }
  }

  const signature = usageSignature(snapshot.usage)
  if (signature !== '' && signature !== cursor.usageSignature) {
    cursor.usageSignature = signature
    emit({ type: 'usage', usage: mapUsage(snapshot.usage) })
  }

  // The run summary rides on the terminal event, because the decoder would drop a twelfth event name.
  const summary = readRunSummary(snapshot)
  if (snapshot.status === AGENTIC_STATUS.COMPLETED) emit({ type: 'done', turnId, ...summary })
  else if (snapshot.status === AGENTIC_STATUS.ERRORED) {
    emit({
      type: 'error',
      error: { message: snapshot.error ?? 'The copilot run failed.' },
      ...summary,
    })
  } else if (snapshot.status === AGENTIC_STATUS.CANCELLED) emit({ type: 'cancelled' })

  return events
}
