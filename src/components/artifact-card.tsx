import type { ReactNode } from 'react'

export interface ArtifactCardProps {
  title: string
  // A quieter note beside the title: a row count, a unit, a time window.
  sub?: string
  children: ReactNode
}

// The one shell every artifact an answer carries sits in: a chart from the host renderer, the
// result table, later a note or a checklist. Hosts style the shell once through the tokens and
// every artifact follows.
export function ArtifactCard({ title, sub, children }: ArtifactCardProps): ReactNode {
  return (
    <section className='nxcp-artifact' aria-label={title}>
      <div className='nxcp-artifact-head'>
        <span className='nxcp-artifact-title'>{title}</span>
        {sub ? <span className='nxcp-artifact-sub'>{sub}</span> : null}
      </div>
      {children}
    </section>
  )
}
