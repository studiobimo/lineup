import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { plannerStore } from './planner'
import { PlannerPage } from './planner-page'
import type { ProcessedImage } from './process-image'

const processed = {
  width: 10,
  height: 10,
  thumbnail: new Uint8Array([1]),
  publish: new Uint8Array([2])
} as unknown as ProcessedImage

describe('PlannerPage', () => {
  beforeEach(async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL() {} })
    )
    plannerStore.setState({ board: { tray: [], grid: [] }, images: {}, past: [], future: [] })
    await plannerStore.getState().load()
  })

  it('says what to do with an empty grid', async () => {
    render(<PlannerPage />)
    expect(await screen.findByText('Move images here to plan your feed.')).toBeInTheDocument()
  })

  it('moves a cell to the grid, and undoes it', async () => {
    const user = userEvent.setup()
    plannerStore.getState().clear(['tray', 'grid'])
    await plannerStore.getState().addImages([processed])
    const [id] = plannerStore.getState().board.tray
    plannerStore.getState().move(id, 'grid')
    render(<PlannerPage />)

    const cell = await screen.findByRole('img', { name: 'Image 1' })
    expect(cell).toHaveAttribute('src', 'blob:x')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(plannerStore.getState().board.grid).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(plannerStore.getState().board.grid).toEqual([id])
  })

  it('leaves undo and redo disabled when there is nothing to do', () => {
    plannerStore.setState({ past: [], future: [] })
    render(<PlannerPage />)
    const history = screen.getByRole('button', { name: 'Undo' }).parentElement!
    for (const button of within(history).getAllByRole('button')) expect(button).toBeDisabled()
  })
})
