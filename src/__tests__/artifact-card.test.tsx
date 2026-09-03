import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ArtifactCard } from '../components/artifact-card'

describe('ArtifactCard', () => {
  it('names the card after its title so assistive tech can land on it', () => {
    render(
      <ArtifactCard title='AHU-1 supply temperature'>
        <p>body</p>
      </ArtifactCard>,
    )
    const card = screen.getByRole('region', { name: 'AHU-1 supply temperature' })
    expect(card.className).toBe('nxcp-artifact')
    expect(card.querySelector('.nxcp-artifact-title')?.textContent).toBe('AHU-1 supply temperature')
    expect(screen.getByText('body')).toBeTruthy()
  })

  it('shows the quieter note only when there is one', () => {
    const { rerender } = render(
      <ArtifactCard title='Result'>
        <span />
      </ArtifactCard>,
    )
    expect(document.querySelector('.nxcp-artifact-sub')).toBeNull()
    rerender(
      <ArtifactCard title='Result' sub='24 rows'>
        <span />
      </ArtifactCard>,
    )
    expect(document.querySelector('.nxcp-artifact-sub')?.textContent).toBe('24 rows')
  })
})
