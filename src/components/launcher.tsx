import type { ReactNode } from 'react'
import { useState } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import { themeToCssVars } from '../ui/theme'

export interface LauncherProps {
  onOpen: () => void
}

// The floating pill CopilotDock shows while minimised. The dock portals it into document.body
// alongside the card, so it shares the same z band and escapes any host stacking context.
export function Launcher({ onOpen }: LauncherProps): ReactNode {
  const { t, theme } = useCopilotAdapters()
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      type='button'
      className='nxcp-root nxcp-launcher'
      style={themeToCssVars(theme)}
      aria-label={t('copilot.dock.open')}
      data-expanded={expanded ? 'true' : 'false'}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      onClick={() => {
        setExpanded(false)
        onOpen()
      }}
    >
      <span className='nxcp-launcher-halo' aria-hidden='true' />
      <span className='nxcp-launcher-tile' aria-hidden='true'>
        <svg
          width={18}
          height={18}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={1.9}
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <path d='M12 3.2 13.9 9l5.9 2-5.9 2L12 18.8 10.1 13 4.2 11l5.9-2z' />
          <path d='M18.4 3.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z' />
        </svg>
      </span>
      <span className='nxcp-launcher-label'>{t('copilot.dock.open')}</span>
      {expanded ? (
        <svg
          className='nxcp-launcher-chevron'
          width={14}
          height={14}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.4}
          aria-hidden='true'
        >
          <path d='M5 12h14M13 6l6 6-6 6' />
        </svg>
      ) : null}
    </button>
  )
}
