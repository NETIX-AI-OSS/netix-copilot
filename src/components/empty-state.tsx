import type { ReactNode } from 'react'

// The four-point spark the reference uses in place of a glyph character.
const SPARK_PATH = 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z'

export function SparkIcon({ size }: { size: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
      <path d={SPARK_PATH} />
    </svg>
  )
}

export interface QuickPromptsProps {
  chips: readonly string[]
  onSelect: (prompt: string) => void
}

export function QuickPrompts({ chips, onSelect }: QuickPromptsProps): ReactNode {
  if (chips.length === 0) return null
  return (
    <div className='nxcp-quick-prompts'>
      {chips.map((prompt) => (
        <button
          key={prompt}
          type='button'
          className='nxcp-quick-prompt'
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}

export interface EmptyStateProps extends QuickPromptsProps {
  heading: ReactNode
  body: ReactNode
}

export function EmptyState({ heading, body, chips, onSelect }: EmptyStateProps): ReactNode {
  return (
    <div className='nxcp-empty-state'>
      <span className='nxcp-empty-tile'>
        <SparkIcon size={22} />
      </span>
      <h3 className='nxcp-empty-heading'>{heading}</h3>
      <p className='nxcp-empty-body'>{body}</p>
      <QuickPrompts chips={chips} onSelect={onSelect} />
    </div>
  )
}
