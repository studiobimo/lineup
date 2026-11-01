import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TypeSpecimen } from './type-specimen'

describe('TypeSpecimen', () => {
  it('shows one h1, and every heading level below it', () => {
    render(<TypeSpecimen />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const level of [2, 3, 4, 5, 6]) {
      expect(screen.getAllByRole('heading', { level }).length).toBeGreaterThan(0)
    }
  })

  it('shows each weight a font has, and none it does not', () => {
    render(<TypeSpecimen />)
    const weights = (name: string) =>
      within(screen.getByText(name).parentElement!).getAllByRole('listitem')
    expect(weights('Space Grotesk')).toHaveLength(5)
    expect(weights('Bitcount Prop Double')).toHaveLength(9)
    expect(weights('Bitcount Single')).toHaveLength(9)
  })
})
