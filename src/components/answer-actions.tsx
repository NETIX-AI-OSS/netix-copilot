import type { ReactNode } from 'react'

import { useCopilotAdapters, useCopilotRegenerate, useCopilotState } from '../adapters/context'
import type { CopilotTurnView } from '../runtime/engine'
import { isRunActive } from '../runtime/run-store'
import { agentSteps, isAgentStep } from '../runtime/trace-model'
import type { RunState } from '../types'
import { useNotify } from './notify'

export interface AnswerActionsProps {
  turn: CopilotTurnView
  // The grounding caption: what the run used and how long it took.
  showCaption?: boolean
}

// The clipboard API is absent on plain-http hosts and inside some embedded webviews, where the
// selection command still works.
function legacyCopy(text: string): boolean {
  const box = document.createElement('textarea')
  box.value = text
  box.setAttribute('readonly', '')
  box.style.position = 'fixed'
  box.style.opacity = '0'
  document.body.appendChild(box)
  box.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    box.remove()
  }
}

async function copyText(text: string): Promise<boolean> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text)
      return true
    } catch {
      // Permission denied or no user gesture: the selection command may still work.
    }
  }
  return legacyCopy(text)
}

// The `done` payload names the tools ml-engine reports; a rebuilt or truncated summary may not
// carry them, so the steps that ran are the next best count.
export function groundingCounts(run: RunState): { tools: number; agents: number } {
  const reported = (run.tools ?? []).length
  const tools = reported > 0 ? reported : run.steps.filter((step) => !isAgentStep(step)).length
  return { tools, agents: agentSteps(run.steps).length }
}

// The strip under a finished answer: copy, regenerate and the grounding caption. Regenerate only
// belongs to the newest turn -- an earlier one would re-ask a question the thread has moved past.
export function AnswerActions({ turn, showCaption = true }: AnswerActionsProps): ReactNode {
  const { t } = useCopilotAdapters()
  const state = useCopilotState()
  const notify = useNotify()
  const regenerate = useCopilotRegenerate()
  const { run } = turn
  const newest = state.turns[state.turns.length - 1]
  const busy = state.sending || (newest !== undefined && isRunActive(newest.run))
  const canRegenerate = newest?.id === turn.id
  const caption = showCaption && run.status === 'done' && run.executionMs !== undefined

  const copy = () => {
    void copyText(run.text).then((copied) => {
      notify(
        copied
          ? { message: t('copilot.answer.copied') }
          : { message: t('copilot.answer.copyUnavailable'), tone: 'error' },
      )
    })
  }

  if (run.text === '' && !canRegenerate && !caption) return null

  const { tools, agents } = groundingCounts(run)
  const seconds = ((run.executionMs ?? 0) / 1000).toFixed(1)

  return (
    <div className='nxcp-actions'>
      {run.text !== '' ? (
        <button
          type='button'
          className='nxcp-actions-button'
          title={t('copilot.answer.copy')}
          aria-label={t('copilot.answer.copy')}
          onClick={copy}
        >
          <svg
            width='12'
            height='12'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.2'
            aria-hidden='true'
            focusable='false'
          >
            <rect x='9' y='9' width='12' height='12' rx='2' />
            <path d='M5 15V5a2 2 0 0 1 2-2h10' />
          </svg>
        </button>
      ) : null}
      {canRegenerate ? (
        <button
          type='button'
          className='nxcp-actions-button'
          title={t('copilot.answer.regenerate')}
          aria-label={t('copilot.answer.regenerate')}
          disabled={busy}
          onClick={() => regenerate(turn.id)}
        >
          <svg
            width='12'
            height='12'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.2'
            aria-hidden='true'
            focusable='false'
          >
            <path d='M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6' />
          </svg>
        </button>
      ) : null}
      {caption ? (
        <span className='nxcp-actions-caption'>
          {agents > 0
            ? t('copilot.answer.groundingAgents', { tools, agents, seconds })
            : t('copilot.answer.grounding', { tools, seconds })}
        </span>
      ) : null}
    </div>
  )
}
