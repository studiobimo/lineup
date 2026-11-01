import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Board, ImageRecord, StoredImage } from './board-store'
import { createPlannerStore, type PlannerState } from './planner-store'
import type { ProcessedImage } from './process-image'

const processed = {
  width: 10,
  height: 10,
  thumbnail: new Blob(),
  publish: new Blob()
} as ProcessedImage

function fakeBoardStore(board: Board = { tray: [], grid: [] }, ids: string[] = []) {
  const images = new Map<string, ImageRecord>(
    ids.map((id) => [id, { id, width: 1, height: 1, createdAt: '2026-11-01T12:00:00Z' }])
  )
  const fake = {
    saved: board,
    loadBoard: vi.fn(async () => board),
    saveBoard: vi.fn(async (next: Board) => {
      fake.saved = next
    }),
    listImages: vi.fn(async () => [...images.values()]),
    putImage: vi.fn(async (image: StoredImage) => {
      images.set(image.id, image)
    }),
    getThumbnail: vi.fn(),
    getPublishCopy: vi.fn(),
    deleteImages: vi.fn(async (gone: string[]) => gone.forEach((id) => images.delete(id))),
    storageUsage: vi.fn(async () => ({ used: 0, quota: 0 })),
    requestPersistence: vi.fn(async () => true)
  }
  return fake
}

const start = { tray: ['a', 'b'], grid: ['c', 'd', 'e'] }

async function loaded(board: Board = start) {
  const boardStore = fakeBoardStore(board, [...board.tray, ...board.grid])
  const store = createPlannerStore(boardStore)
  await store.getState().load()
  return { boardStore, store, state: () => store.getState() }
}

describe('the planner store', () => {
  describe('every action can be undone and redone exactly', () => {
    const actions: [string, (state: PlannerState) => void | Promise<void>][] = [
      ['import', (state) => state.addImages([processed, processed])],
      ['move', (state) => state.move('a', 'grid')],
      ['insert', (state) => state.move('a', 'grid', 1)],
      ['swap', (state) => state.swap('a', 'd')],
      ['move all', (state) => state.moveAll('tray')],
      ['shuffle', (state) => state.shuffle('grid')],
      ['delete', (state) => state.remove(['a', 'd'])],
      ['clear', (state) => state.clear(['tray', 'grid'])]
    ]

    beforeEach(() => {
      // A shuffle that lands on the same order would not be a change to undo.
      vi.spyOn(Math, 'random').mockReturnValue(0)
    })

    it.each(actions)('%s', async (_name, act) => {
      const { boardStore, state } = await loaded()
      await act(state())
      const changed = state().board
      expect(changed).not.toEqual(start)
      expect(boardStore.saved).toEqual(changed)

      state().undo()
      expect(state().board).toEqual(start)
      expect(boardStore.saved).toEqual(start)

      state().redo()
      expect(state().board).toEqual(changed)
      expect(boardStore.saved).toEqual(changed)
    })
  })

  it('clears redo on a new change', async () => {
    const { state } = await loaded()
    state().move('a', 'grid')
    state().undo()
    state().swap('c', 'd')
    expect(state().future).toEqual([])
    const after = state().board
    state().redo()
    expect(state().board).toEqual(after)
  })

  it('does nothing when there is nothing to undo or redo', async () => {
    const { boardStore, state } = await loaded()
    state().undo()
    state().redo()
    expect(state().board).toEqual(start)
    expect(boardStore.saveBoard).not.toHaveBeenCalled()
  })

  it('adds no step for an action that changes nothing', async () => {
    const { state } = await loaded()
    state().remove(['not-on-the-board'])
    state().clear([])
    expect(state().past).toEqual([])
  })

  it('puts imported images at the top of the tray with records and no bytes', async () => {
    const { boardStore, state } = await loaded()
    await state().addImages([processed])

    const [id] = state().board.tray
    expect(state().board.tray).toEqual([id, 'a', 'b'])
    expect(state().images[id]).toEqual({
      id,
      width: 10,
      height: 10,
      createdAt: expect.any(String)
    })
    expect(JSON.stringify(state())).not.toContain('thumbnail')
    expect(boardStore.putImage).toHaveBeenCalledOnce()
  })

  it('keeps a deleted image until no step can bring it back', async () => {
    const { boardStore, state } = await loaded({ tray: ['a', 'b'], grid: [] })
    state().remove(['a'])
    expect(boardStore.deleteImages).not.toHaveBeenCalled()
    expect(state().images.a).toBeDefined()

    // 49 more steps fill the history, and the delete is still the oldest of them.
    for (let step = 0; step < 49; step += 1) state().move('b', step % 2 === 0 ? 'grid' : 'tray')
    expect(state().past).toHaveLength(50)
    expect(boardStore.deleteImages).not.toHaveBeenCalled()

    state().move('b', 'grid', 0)
    state().move('b', 'tray')
    expect(state().past).toHaveLength(50)
    expect(boardStore.deleteImages).toHaveBeenCalledWith(['a'])
    expect(state().images.a).toBeUndefined()
  })

  it('purges an undone import once a new change makes redo impossible', async () => {
    const { boardStore, state } = await loaded()
    await state().addImages([processed])
    const [id] = state().board.tray

    state().undo()
    expect(boardStore.deleteImages).not.toHaveBeenCalled()

    state().swap('a', 'b')
    expect(boardStore.deleteImages).toHaveBeenCalledWith([id])
  })

  it('restores a saved board on load, and purges images it no longer reaches', async () => {
    const boardStore = fakeBoardStore({ tray: ['a'], grid: ['b'] }, ['a', 'b', 'left-behind'])
    const store = createPlannerStore(boardStore)

    await store.getState().load()

    expect(store.getState()).toMatchObject({ board: { tray: ['a'], grid: ['b'] }, ready: true })
    expect(boardStore.deleteImages).toHaveBeenCalledWith(['left-behind'])
  })

  it('drops a cell whose image is gone, so nothing renders it', async () => {
    const boardStore = fakeBoardStore({ tray: ['a', 'gone'], grid: [] }, ['a'])
    const store = createPlannerStore(boardStore)
    await store.getState().load()
    expect(store.getState().board.tray).toEqual(['a'])
  })

  it('writes nothing once another tab has the board', async () => {
    const { boardStore, state } = await loaded()
    state().move('a', 'grid')
    state().undo()
    boardStore.saveBoard.mockClear()
    boardStore.deleteImages.mockClear()

    state().suspend()
    state().move('a', 'grid')
    state().redo()
    state().undo()
    state().remove(['a'])
    await state().addImages([processed])

    expect(state().board).toEqual(start)
    expect(boardStore.saveBoard).not.toHaveBeenCalled()
    expect(boardStore.putImage).not.toHaveBeenCalled()
    expect(boardStore.deleteImages).not.toHaveBeenCalled()
  })

  it('reads the board afresh when it comes back, with no history from before', async () => {
    const { boardStore, state } = await loaded()
    state().move('a', 'grid')
    state().suspend()

    boardStore.loadBoard.mockResolvedValueOnce({ tray: [], grid: ['e', 'd', 'c', 'b', 'a'] })
    await state().load()

    expect(state().board.grid).toEqual(['e', 'd', 'c', 'b', 'a'])
    expect(state()).toMatchObject({ past: [], future: [], session: 'active' })
  })

  it('says when a save fails, and clears it when one works', async () => {
    const { boardStore, state } = await loaded()
    boardStore.saveBoard.mockRejectedValueOnce(new Error('quota'))
    state().move('a', 'grid')
    await vi.waitFor(() => expect(state().saveFailed).toBe(true))

    state().move('b', 'grid')
    await vi.waitFor(() => expect(state().saveFailed).toBe(false))
  })
})
