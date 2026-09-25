import type { ReactNode, RefObject } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

import { useCopilotAdapters, useCopilotModelTier, useCopilotState } from '../adapters/context'
import { MODEL_TIERS } from '../types'

// The composer's two small popovers: the response tier, and the usage meter. Both open above
// their trigger and close on a choice, on Escape and on a press outside.

function usePopover(): {
  open: boolean
  setOpen: (next: boolean | ((current: boolean) => boolean)) => void
  root: RefObject<HTMLDivElement | null>
  trigger: RefObject<HTMLButtonElement | null>
} {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Escape closes this popover only; the sheet around it must not also close.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  return { open, setOpen, root, trigger }
}

function Check(): ReactNode {
  return (
    <svg
      width={14}
      height={14}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2.4}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M5 12l5 5L20 7' />
    </svg>
  )
}

// A plain dropdown: the tier on a pill, the three tiers in the popover. Nothing else lives here.
export function TierMenu(): ReactNode {
  const { t } = useCopilotAdapters()
  const { tier, locked, setTier } = useCopilotModelTier()
  const { open, setOpen, root, trigger } = usePopover()
  const menuId = useId()
  const tierLabel = t(`copilot.tier.${tier}`)

  return (
    <div className='nxcp-popover-root' ref={root}>
      <button
        ref={trigger}
        type='button'
        className='nxcp-tier-selector'
        data-locked={locked ? 'true' : 'false'}
        aria-label={`${t('copilot.tier.label')}: ${tierLabel}`}
        title={locked ? t('copilot.tier.locked') : undefined}
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className='nxcp-tier-value'>{tierLabel}</span>
        <span className='nxcp-tier-chevron' aria-hidden='true' />
      </button>
      {open ? (
        <div
          id={menuId}
          className='nxcp-popover nxcp-tier-menu'
          role='dialog'
          aria-label={t('copilot.tier.label')}
        >
          <span className='nxcp-popover-label' id={`${menuId}-label`}>
            {t('copilot.tier.label')}
          </span>
          <div role='radiogroup' aria-labelledby={`${menuId}-label`} className='nxcp-tier-options'>
            {MODEL_TIERS.map((entry) => (
              <button
                key={entry.key}
                type='button'
                role='radio'
                aria-checked={entry.key === tier}
                className='nxcp-tier-option'
                disabled={locked}
                onClick={() => {
                  setTier(entry.key)
                  setOpen(false)
                  trigger.current?.focus()
                }}
              >
                <span>{t(`copilot.tier.${entry.key}`)}</span>
                {entry.key === tier ? <Check /> : null}
              </button>
            ))}
          </div>
          {locked ? <p className='nxcp-popover-note'>{t('copilot.tier.locked')}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

const RING_RADIUS = 7
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function compact(value: number, locale: string | undefined): string {
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
      value,
    )
  } catch {
    return String(value)
  }
}

// The small ring beside Send, as coding agents show it: it fills with the share of the model's
// context window the last reply used, and opens the usage figures. It only fills against a window
// the backend reported, and it is absent until there is something real to show.
export function UsageMeter(): ReactNode {
  const { t, locale } = useCopilotAdapters()
  const state = useCopilotState()
  const { open, setOpen, root, trigger } = usePopover()
  const panelId = useId()
  const run = state.turns[state.turns.length - 1]?.run
  const usage = run?.usage
  const hasUsage =
    usage !== undefined &&
    (usage.tokensIn !== undefined ||
      usage.tokensOut !== undefined ||
      usage.calls !== undefined ||
      usage.costUsd !== undefined ||
      usage.creditsRemaining !== undefined)
  // A fresh conversation has nothing to measure, even if an earlier one left a transport behind.
  if (run === undefined || (!hasUsage && state.transport === undefined)) return null

  const contextWindow = usage?.contextWindow
  const used = usage?.tokensIn
  const share =
    contextWindow !== undefined && used !== undefined
      ? Math.min(1, Math.max(0, used / contextWindow))
      : undefined
  const percent = share === undefined ? undefined : Math.round(share * 100)
  const label =
    percent === undefined
      ? t('copilot.usage.open')
      : `${t('copilot.usage.open')}: ${t('copilot.usage.context')} ${percent}%`

  const rows: { key: string; label: string; value: string }[] = []
  if (usage?.tokensIn !== undefined) {
    rows.push({
      key: 'in',
      label: t('copilot.usage.input'),
      value: compact(usage.tokensIn, locale),
    })
  }
  if (usage?.tokensOut !== undefined) {
    rows.push({
      key: 'out',
      label: t('copilot.usage.output'),
      value: compact(usage.tokensOut, locale),
    })
  }
  if (usage?.calls !== undefined) {
    rows.push({ key: 'calls', label: t('copilot.usage.callsLabel'), value: String(usage.calls) })
  }
  if (usage?.costUsd !== undefined) {
    rows.push({
      key: 'cost',
      label: t('copilot.usage.cost'),
      value: `$${usage.costUsd.toFixed(4)}`,
    })
  }
  if (usage?.creditsRemaining !== undefined) {
    rows.push({
      key: 'credits',
      label: t('copilot.usage.creditsLeft'),
      value: compact(usage.creditsRemaining, locale),
    })
  }
  if (usage?.model !== undefined) {
    rows.push({ key: 'model', label: t('copilot.usage.model'), value: usage.model })
  }

  return (
    <div className='nxcp-popover-root' ref={root}>
      <button
        ref={trigger}
        type='button'
        className='nxcp-usage-meter'
        aria-label={label}
        title={label}
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-level={
          share === undefined ? 'unknown' : share >= 0.9 ? 'high' : share >= 0.7 ? 'mid' : 'low'
        }
        onClick={() => setOpen((current) => !current)}
      >
        {share === undefined ? (
          // No context window reported: a plain usage glyph, never a ring that looks like progress.
          <svg
            width={16}
            height={16}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            aria-hidden='true'
          >
            <path d='M5 20V11M12 20V4M19 20v-6' />
          </svg>
        ) : (
          <svg width={18} height={18} viewBox='0 0 18 18' aria-hidden='true'>
            <circle className='nxcp-usage-track' cx={9} cy={9} r={RING_RADIUS} />
            <circle
              className='nxcp-usage-fill'
              cx={9}
              cy={9}
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - share)}
            />
          </svg>
        )}
      </button>
      {open ? (
        <div
          id={panelId}
          className='nxcp-popover nxcp-usage-panel'
          role='dialog'
          aria-label={t('copilot.usage.open')}
        >
          {share === undefined || contextWindow === undefined || used === undefined ? null : (
            // Only when the backend reports the window; otherwise there is no share to show.
            <div className='nxcp-usage-context'>
              <div className='nxcp-usage-context-head'>
                <span>{t('copilot.usage.context')}</span>
                <strong>{percent}%</strong>
              </div>
              <div className='nxcp-usage-bar' aria-hidden='true'>
                <span style={{ width: `${share * 100}%` }} />
              </div>
              <p className='nxcp-popover-note'>
                {t('copilot.usage.contextOf', {
                  used: compact(used, locale),
                  total: compact(contextWindow, locale),
                })}
              </p>
            </div>
          )}
          {rows.length > 0 ? (
            <>
              <span className='nxcp-popover-label'>{t('copilot.usage.title')}</span>
              <dl className='nxcp-usage-rows'>
                {rows.map((row) => (
                  <div key={row.key} className='nxcp-usage-row'>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {state.transport ? (
            <div className='nxcp-usage-row nxcp-usage-connection'>
              <span>{t('copilot.usage.connection')}</span>
              <span className='nxcp-usage-connection-value'>
                <span
                  className='nxcp-transport-dot'
                  data-transport={state.transport}
                  role='img'
                  aria-label={t(`copilot.transport.${state.transport}`)}
                />
                {t(`copilot.transport.${state.transport}`)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
