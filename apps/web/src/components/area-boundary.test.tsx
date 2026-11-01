import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AreaBoundary } from './area-boundary'

let broken = true

function Fragile() {
  if (broken) throw new Error('broken')
  return <p>working</p>
}

describe('AreaBoundary', () => {
  it('keeps a crash to its own area, and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(
      <>
        <p>neighbour</p>
        <AreaBoundary>
          <Fragile />
        </AreaBoundary>
      </>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('neighbour')).toBeInTheDocument()

    broken = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('working')).toBeInTheDocument()
  })
})
