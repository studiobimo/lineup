import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { boardStore, plannerStore } from './planner'
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
    // The page does the loading, so a test cannot seed a board that a late load then overwrites.
    await boardStore.saveBoard({ tray: [], grid: [] })
    plannerStore.setState({ images: {}, past: [], future: [], ready: false, session: 'starting' })
  })

  it('says what to do with an empty grid', async () => {
    render(<PlannerPage />)
    expect(await screen.findByText('Move images here to plan your feed.')).toBeInTheDocument()
  })

  it('moves a cell to the grid, and undoes it', async () => {
    const user = userEvent.setup()
    render(<PlannerPage />)
    await screen.findByText('Move images here to plan your feed.')

    await act(async () => {
      plannerStore.getState().clear(['tray', 'grid'])
      await plannerStore.getState().addImages([processed])
      plannerStore.getState().moveAll('tray')
    })
    const [id] = plannerStore.getState().board.grid

    await screen.findByRole('img', { name: 'Image 1' })

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(plannerStore.getState().board.grid).toEqual([])
    expect(plannerStore.getState().board.tray).toEqual([id])
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(plannerStore.getState().board.grid).toEqual([id])
  })

  it('leaves undo and redo disabled when there is nothing to do', () => {
    render(<PlannerPage />)
    const history = screen.getByRole('button', { name: 'Undo' }).parentElement!
    for (const button of within(history).getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('undoes and redoes from the keyboard, but not from a text field', async () => {
    const user = userEvent.setup()
    render(
      <>
        <PlannerPage />
        <input aria-label="Caption" />
      </>
    )
    await waitFor(() => expect(plannerStore.getState().session).toBe('active'))
    await act(async () => {
      plannerStore.getState().clear(['tray', 'grid'])
      await plannerStore.getState().addImages([processed])
      plannerStore.getState().moveAll('tray')
    })
    const [id] = plannerStore.getState().board.grid

    await user.click(screen.getByLabelText('Caption'))
    await user.keyboard('{Control>}z{/Control}')
    expect(plannerStore.getState().board.grid).toEqual([id])

    await user.click(document.body)
    await user.keyboard('{Control>}z{/Control}')
    expect(plannerStore.getState().board.grid).toEqual([])
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(plannerStore.getState().board.grid).toEqual([id])
  })

  const boardOf = async (tray: number, grid: number) => {
    await waitFor(() => expect(plannerStore.getState().session).toBe('active'))
    await act(async () => {
      plannerStore.getState().clear(['tray', 'grid'])
      await plannerStore.getState().addImages(Array.from({ length: grid }, () => processed))
      plannerStore.getState().moveAll('tray')
      await plannerStore.getState().addImages(Array.from({ length: tray }, () => processed))
    })
    return plannerStore.getState().board
  }

  it('moves everything across, and undoes it', async () => {
    const user = userEvent.setup()
    render(<PlannerPage />)
    const before = await boardOf(2, 1)

    await user.click(screen.getByRole('button', { name: 'Move all to the grid' }))
    expect(plannerStore.getState().board).toEqual({
      tray: [],
      grid: [...before.grid, ...before.tray]
    })
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(plannerStore.getState().board).toEqual(before)
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(plannerStore.getState().board.tray).toEqual([])
  })

  it('needs two cells to shuffle', async () => {
    render(<PlannerPage />)
    await boardOf(2, 1)
    expect(screen.getByRole('button', { name: 'Shuffle the tray' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Shuffle the grid' })).toBeDisabled()
  })

  it('says how many images each choice clears, and undoes it', async () => {
    const user = userEvent.setup()
    render(<PlannerPage />)
    const before = await boardOf(2, 1)

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Tray (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grid (1)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Both (3)' }))

    expect(plannerStore.getState().board).toEqual({ tray: [], grid: [] })
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(plannerStore.getState().board).toEqual(before)
  })

  it('deletes the focused cell with the Delete key, and moves focus on', async () => {
    const user = userEvent.setup()
    render(<PlannerPage />)
    const before = await boardOf(0, 2)
    const [first, second] = before.grid

    screen.getByRole('group', { name: 'Image 1' }).focus()
    await user.keyboard('{Delete}')
    expect(plannerStore.getState().board.grid).toEqual([second])
    expect(document.activeElement).toHaveAttribute('data-drop-id', second)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(plannerStore.getState().board.grid).toEqual([first, second])
  })
})
