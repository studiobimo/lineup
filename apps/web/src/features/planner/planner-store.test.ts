import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageColour } from '@/features/autosort/colour'

import type { BoardJournal } from './board-journal'
import type { Board, History, ImageRecord, StoredImage } from './board-store'
import { createPlannerStore, type PlannerState } from './planner-store'
import type { ProcessedImage } from './process-image'

const processed = {
  width: 10,
  height: 10,
  thumbnail: new Blob(),
  publish: new Blob()
} as ProcessedImage

const colour: ImageColour = {
  dominant: { lightness: 0, chroma: 0, hue: 0 },
  palette: [],
  tone: 0,
  vivid: 0
}

function memoryJournal(): BoardJournal {
  let saved: Board | undefined
  return {
    write: (board) => {
      saved = board
    },
    read: () => saved,
    clear: () => {
      saved = undefined
    }
  }
}

function fakeBoardStore(board: Board = { tray: [], grid: [] }, ids: string[] = []) {
  const images = new Map<string, ImageRecord>(
    ids.map((id) => [id, { id, width: 1, height: 1, createdAt: '2026-11-01T12:00:00Z' }])
  )
  const fake = {
    saved: board,
    history: { past: [], future: [] } as History,
    loadBoard: vi.fn(async () => fake.saved),
    saveBoard: vi.fn(async (next: Board) => {
      fake.saved = next
    }),
    loadHistory: vi.fn(async () => fake.history),
    saveHistory: vi.fn(async (next: History) => {
      fake.history = next
    }),
    listImages: vi.fn(async () => [...images.values()]),
    putImage: vi.fn(async (image: StoredImage) => {
      images.set(image.id, image)
    }),
    getThumbnail: vi.fn(),
    getPublishCopy: vi.fn(),
    deleteImages: vi.fn(async (gone: string[]) => gone.forEach((id) => images.delete(id))),
    setColour: vi.fn(async () => undefined),
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

beforeEach(() => localStorage.clear())

describe('the planner store', () => {
  describe('after a reload', () => {
    const reopened = async (boardStore: ReturnType<typeof fakeBoardStore>) => {
      const store = createPlannerStore(boardStore)
      await store.getState().load()
      return store.getState
    }

    it('still undoes and redoes', async () => {
      const { boardStore, state } = await loaded()
      state().swap('c', 'd')
      state().move('a', 'grid')
      state().undo()

      const after = await reopened(boardStore)
      expect(after().past).toHaveLength(1)
      after().redo()
      expect(after().board.grid).toContain('a')
      after().undo()
      after().undo()
      expect(after().board).toEqual(start)
    })

    it('keeps an image a stored step can still bring back', async () => {
      const { boardStore, state } = await loaded()
      state().remove(['a'])
      const after = await reopened(boardStore)
      expect(boardStore.deleteImages).not.toHaveBeenCalled()
      after().undo()
      expect(after().board.tray).toEqual(['a', 'b'])
      expect(after().images.a).toBeDefined()
    })

    it('forgets a step for an image that is gone, and keeps the rest of it', async () => {
      const { boardStore, state } = await loaded()
      state().swap('c', 'd')
      boardStore.history.past[0].grid.push('gone')
      const after = await reopened(boardStore)
      expect(after().past[0].grid).toEqual(start.grid)
    })
  })

  it('sorts, shuffles and clears around a locked cell, and keeps it through a reload', async () => {
    const { boardStore, state } = await loaded()
    state().toggleLock('d')
    state().shuffle('grid')
    expect(state().board.grid[1]).toBe('d')
    state().clear(['grid'])
    expect(state().board.grid).toEqual(['d'])
    state().remove(['d'])
    expect(state().board.grid).toEqual(['d'])
    expect(boardStore.saved.locked).toEqual(['d'])
  })

  describe('sorting by colour', () => {
    const shade = (hue: number, lightness = 0.6) => {
      const dominant = { lightness, chroma: 0.2, hue }
      return { dominant, palette: [dominant], tone: lightness, vivid: 0.5 }
    }

    async function coloured() {
      const opened = await loaded({ tray: ['grey'], grid: ['blue', 'red', 'green'] })
      opened.state().setColour('blue', shade(264))
      opened.state().setColour('red', shade(29))
      opened.state().setColour('green', shade(142))
      return opened
    }

    it('is one undo step that restores the exact order, and redoes', async () => {
      const { boardStore, state } = await coloured()
      await state().sortByColour('grid', 'rainbow')
      expect(state().board.grid).toEqual(['red', 'green', 'blue'])
      expect(boardStore.saved.grid).toEqual(['red', 'green', 'blue'])
      expect(state().past).toHaveLength(1)

      state().undo()
      expect(state().board.grid).toEqual(['blue', 'red', 'green'])
      state().redo()
      expect(state().board.grid).toEqual(['red', 'green', 'blue'])
    })

    it('leaves the other container alone', async () => {
      const { state } = await coloured()
      await state().sortByColour('grid', 'rainbow')
      expect(state().board.tray).toEqual(['grey'])
    })

    it('is not a mode: the next manual move stays where it is put', async () => {
      const { state } = await coloured()
      await state().sortByColour('grid', 'rainbow')
      state().swap('red', 'blue')
      expect(state().board.grid).toEqual(['blue', 'green', 'red'])
    })

    it('drops an order that a newer change has overtaken', async () => {
      const { state } = await coloured()
      const sorting = state().sortByColour('grid', 'rainbow')
      state().swap('blue', 'green')
      await sorting
      expect(state().board.grid).toEqual(['green', 'red', 'blue'])
      expect(state().past).toHaveLength(1)
    })

    it('adds no undo step when the order is already right', async () => {
      const { state } = await coloured()
      await state().sortByColour('grid', 'rainbow')
      await state().sortByColour('grid', 'rainbow')
      expect(state().past).toHaveLength(1)
    })
  })

  describe('every action can be undone and redone exactly', () => {
    const actions: [string, (state: PlannerState) => void | Promise<void>][] = [
      ['import', (state) => state.addImages([processed, processed])],
      ['move', (state) => state.move('a', 'grid')],
      ['insert', (state) => state.move('a', 'grid', 1)],
      ['swap', (state) => state.swap('a', 'd')],
      ['move all', (state) => state.moveAll('tray')],
      ['shuffle', (state) => state.shuffle('grid')],
      ['lock', (state) => state.toggleLock('d')],
      [
        'restore',
        (state) =>
          state.restore({
            board: { tray: ['a'], grid: ['z'], locked: ['z'] },
            images: [
              {
                id: 'z',
                width: 1,
                height: 1,
                createdAt: '2026-11-01T12:00:00Z',
                thumbnail: new Blob(),
                publish: new Blob()
              }
            ]
          })
      ],
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

  it('restores a saved board on load', async () => {
    const boardStore = fakeBoardStore({ tray: ['a'], grid: ['b'] }, ['a', 'b'])
    const store = createPlannerStore(boardStore)

    await store.getState().load()

    expect(store.getState()).toMatchObject({ board: { tray: ['a'], grid: ['b'] }, ready: true })
    expect(boardStore.deleteImages).not.toHaveBeenCalled()
  })

  it('opens a board saved before albums exactly as it was', async () => {
    const saved = { tray: ['a'], grid: ['b'], locked: ['b'] }
    const boardStore = fakeBoardStore(saved, ['a', 'b'])
    const store = createPlannerStore(boardStore)
    await store.getState().load()

    expect(store.getState().board).toStrictEqual(saved)
    expect(store.getState().past).toEqual([])
    expect(boardStore.saveBoard).not.toHaveBeenCalled()
  })

  it('counts an image in an album as placed, and keeps it', async () => {
    const saved = { tray: ['album'], grid: [], albums: { album: ['a', 'b'] } }
    const boardStore = fakeBoardStore(saved, ['a', 'b'])
    const store = createPlannerStore(boardStore)
    await store.getState().load()

    expect(store.getState().board).toEqual(saved)
    expect(boardStore.deleteImages).not.toHaveBeenCalled()
  })

  it('holds an image on as long as a snapshot of its album can bring it back', async () => {
    const saved = { tray: ['album', 'c'], grid: [], albums: { album: ['a', 'b'] } }
    const boardStore = fakeBoardStore(saved, ['a', 'b', 'c'])
    const store = createPlannerStore(boardStore)
    await store.getState().load()

    store.getState().remove(['album'])
    expect(boardStore.deleteImages).not.toHaveBeenCalled()
    store.getState().undo()
    expect(store.getState().board).toEqual(saved)
  })

  it('sorts an album by its cover, and keeps it one cell', async () => {
    const tone = (lightness: number) => ({ ...colour, dominant: { ...colour.dominant, lightness } })
    const saved = { tray: ['album', 'c'], grid: [], albums: { album: ['a', 'b'] } }
    const boardStore = fakeBoardStore(saved, ['a', 'b', 'c'])
    const store = createPlannerStore(boardStore)
    await store.getState().load()
    store.getState().setColour('a', tone(0.1))
    store.getState().setColour('b', tone(0.9))
    store.getState().setColour('c', tone(0.5))

    await store.getState().sortByColour('tray', 'lightToDark')
    expect(store.getState().board.tray).toEqual(['c', 'album'])
  })

  it('puts an image no board reaches in the tray, as a step that can be undone', async () => {
    const boardStore = fakeBoardStore({ tray: ['a'], grid: [] }, ['a', 'stranded'])
    const store = createPlannerStore(boardStore)
    await store.getState().load()

    expect(store.getState().board.tray).toEqual(['stranded', 'a'])
    expect(boardStore.deleteImages).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(boardStore.saved.tray).toEqual(['stranded', 'a']))

    store.getState().undo()
    expect(store.getState().board.tray).toEqual(['a'])
  })

  it('brings back every image if the board itself was lost', async () => {
    const store = createPlannerStore(fakeBoardStore({ tray: [], grid: [] }, ['a', 'b']))
    await store.getState().load()
    expect(store.getState().board.tray).toEqual(['a', 'b'])
  })

  describe('a change whose save never finished', () => {
    const unfinished = (board: Board) => {
      const journal = memoryJournal()
      journal.write(board)
      return journal
    }

    it('comes back on load, as a step that can be undone', async () => {
      const boardStore = fakeBoardStore({ tray: ['a', 'b'], grid: [] }, ['a', 'b'])
      const journal = unfinished({ tray: ['b'], grid: ['a'] })
      const store = createPlannerStore(boardStore, journal)
      await store.getState().load()

      expect(store.getState().board).toEqual({ tray: ['b'], grid: ['a'] })
      await vi.waitFor(() => expect(boardStore.saved.grid).toEqual(['a']))
      await vi.waitFor(() => expect(journal.read()).toBeUndefined())

      store.getState().undo()
      expect(store.getState().board).toEqual({ tray: ['a', 'b'], grid: [] })
    })

    it('adds nothing when the save did finish', async () => {
      const board = { tray: ['a'], grid: [] }
      const journal = unfinished(board)
      const store = createPlannerStore(fakeBoardStore(board, ['a']), journal)
      await store.getState().load()

      expect(store.getState().past).toEqual([])
      expect(journal.read()).toBeUndefined()
    })

    it('is ignored if it names an image this store does not hold', async () => {
      const journal = unfinished({ tray: ['from-another-board'], grid: [] })
      const store = createPlannerStore(fakeBoardStore({ tray: ['a'], grid: [] }, ['a']), journal)
      await store.getState().load()

      expect(store.getState().board.tray).toEqual(['a'])
      expect(journal.read()).toBeUndefined()
    })
  })

  it('keeps a change in the journal until its save has finished', async () => {
    const journal = memoryJournal()
    const boardStore = fakeBoardStore({ tray: ['a'], grid: [] }, ['a'])
    const store = createPlannerStore(boardStore, journal)
    await store.getState().load()

    boardStore.saveBoard.mockRejectedValueOnce(new Error('the drive has gone'))
    store.getState().move('a', 'grid')
    expect(journal.read()?.grid).toEqual(['a'])
    await vi.waitFor(() => expect(store.getState().saveFailed).toBe(true))
    expect(journal.read()?.grid).toEqual(['a'])

    store.getState().retrySave()
    await vi.waitFor(() => expect(store.getState().saveFailed).toBe(false))
    expect(journal.read()).toBeUndefined()
    expect(boardStore.saved.grid).toEqual(['a'])
  })

  it('does not take a colour saving for the board being saved', async () => {
    const { boardStore, state } = await loaded()
    boardStore.saveBoard.mockRejectedValueOnce(new Error('the drive has gone'))
    state().move('a', 'grid')
    await vi.waitFor(() => expect(state().saveFailed).toBe(true))
    state().setColour('b', colour)
    await Promise.resolve()
    expect(state().saveFailed).toBe(true)
  })

  it('keeps the images that were stored when others could not be', async () => {
    const { boardStore, state } = await loaded()
    boardStore.putImage.mockRejectedValueOnce(new Error('the disk is full'))
    const before = state().board.tray.length

    await expect(state().addImages([processed, processed])).rejects.toThrow('the disk is full')
    expect(state().board.tray).toHaveLength(before + 1)
  })

  it('drops what a load read if the board went to another tab meanwhile', async () => {
    const boardStore = fakeBoardStore({ tray: ['a'], grid: [] }, ['a'])
    const store = createPlannerStore(boardStore)
    const loading = store.getState().load()
    store.getState().suspend()
    await loading
    expect(store.getState()).toMatchObject({ session: 'elsewhere', ready: false })
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

  it('reads the board and its history afresh when it comes back', async () => {
    const { boardStore, state } = await loaded()
    state().move('a', 'grid')
    state().suspend()

    // What the tab that held the board in the meantime left behind.
    boardStore.loadBoard.mockResolvedValueOnce({ tray: [], grid: ['e', 'd', 'c', 'b', 'a'] })
    boardStore.loadHistory.mockResolvedValueOnce({ past: [], future: [start] })
    await state().load()

    expect(state().board.grid).toEqual(['e', 'd', 'c', 'b', 'a'])
    expect(state()).toMatchObject({ past: [], future: [start], session: 'active' })
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
