import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { boardStore, plannerStore } from './planner'
import { PlannerPage } from './planner-page'
import type { ProcessedImage } from './process-image'
import { loadStrings } from '@/i18n/load-strings'

const processed = {
  width: 10,
  height: 10,
  thumbnail: new Uint8Array([1]),
  publish: new Uint8Array([2])
} as unknown as ProcessedImage

beforeAll(() => loadStrings('planner'))

async function oneImageOnGrid() {
  await act(async () => {
    plannerStore.getState().clear(['tray', 'grid'])
    await plannerStore.getState().addImages([processed])
    plannerStore.getState().moveAll('tray')
  })
  return plannerStore.getState().board.grid[0]
}

describe('PlannerPage', () => {
  beforeEach(async () => {
    await boardStore.deleteImages((await boardStore.listImages()).map(({ id }) => id))
    await boardStore.saveBoard({ tray: [], grid: [] })
    await boardStore.saveHistory({ past: [], future: [] })
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

    const id = await oneImageOnGrid()

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
    const id = await oneImageOnGrid()

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

  it('shows a skeleton until the board has loaded', async () => {
    render(<PlannerPage />)
    expect(screen.getByRole('status', { name: 'Loading your board' })).toBeInTheDocument()
    await screen.findByText('Move images here to plan your feed.')
    expect(screen.queryByRole('status', { name: 'Loading your board' })).not.toBeInTheDocument()
  })

  it('offers to try again when the board cannot be read', async () => {
    const user = userEvent.setup()
    const read = vi.spyOn(boardStore, 'loadBoard').mockRejectedValueOnce(new Error('blocked'))
    render(<PlannerPage />)

    await screen.findByRole('heading', { name: 'Your board could not be opened' })
    read.mockRestore()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Move images here to plan your feed.')
  })
})
