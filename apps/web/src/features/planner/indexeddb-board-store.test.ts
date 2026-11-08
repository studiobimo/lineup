import 'fake-indexeddb/auto'

import { describe, expect, it, vi } from 'vitest'

import type { StoredImage } from './board-store'
import { createIndexedDbBoardStore, migrations } from './indexeddb-board-store'

const blob = (text: string) => new TextEncoder().encode(text) as unknown as Blob

let databases = 0
const uniqueName = () => `lineup-test-${(databases += 1)}`

const image = (id: string): StoredImage => ({
  id,
  width: 1440,
  height: 960,
  createdAt: '2026-11-01T12:00:00Z',
  thumbnail: blob(`thumbnail ${id}`),
  publish: blob(`publish ${id}`)
})

describe('the IndexedDB board store', () => {
  it('starts with an empty board', async () => {
    const store = createIndexedDbBoardStore(uniqueName())
    expect(await store.loadBoard()).toEqual({ tray: [], grid: [] })
    expect(await store.listImages()).toEqual([])
  })

  it('keeps the order of a board across a reopen', async () => {
    const name = uniqueName()
    await createIndexedDbBoardStore(name).saveBoard({ tray: ['b', 'a'], grid: ['d', 'c'] })
    expect(await createIndexedDbBoardStore(name).loadBoard()).toEqual({
      tray: ['b', 'a'],
      grid: ['d', 'c']
    })
  })

  it('keeps both copies of an image across a reopen', async () => {
    const name = uniqueName()
    await createIndexedDbBoardStore(name).putImage(image('a'))

    const reopened = createIndexedDbBoardStore(name)
    expect(await reopened.getThumbnail('a')).toEqual(blob('thumbnail a'))
    expect(await reopened.getPublishCopy('a')).toEqual(blob('publish a'))
  })

  it('lists records with no bytes in them', async () => {
    const store = createIndexedDbBoardStore(uniqueName())
    await store.putImage(image('a'))
    expect(await store.listImages()).toEqual([
      { id: 'a', width: 1440, height: 960, createdAt: '2026-11-01T12:00:00Z' }
    ])
  })

  it('deletes an image with both of its copies', async () => {
    const store = createIndexedDbBoardStore(uniqueName())
    await store.putImage(image('a'))
    await store.putImage(image('b'))

    await store.deleteImages(['a'])

    expect((await store.listImages()).map(({ id }) => id)).toEqual(['b'])
    expect(await store.getThumbnail('a')).toBeUndefined()
    expect(await store.getPublishCopy('a')).toBeUndefined()
    expect(await store.getThumbnail('b')).toBeDefined()
  })

  it('keeps the undo history, and has an empty one to begin with', async () => {
    const store = createIndexedDbBoardStore(crypto.randomUUID())
    expect(await store.loadHistory()).toEqual({ past: [], future: [] })
    const history = { past: [{ tray: ['a'], grid: [] }], future: [] }
    await store.saveHistory(history)
    expect(await store.loadHistory()).toEqual(history)
  })

  it('opens a board saved by an earlier schema, through the migrations after it', async () => {
    const name = uniqueName()
    await createIndexedDbBoardStore(name).saveBoard({ tray: ['a'], grid: [] })

    const upgraded = createIndexedDbBoardStore(name, [
      ...migrations,
      async (_db, transaction) => {
        const boards = transaction.objectStore('board')
        const board = await boards.get('current')
        await boards.put({ tray: [...board!.tray, 'migrated'], grid: board!.grid }, 'current')
      }
    ])

    expect(await upgraded.loadBoard()).toEqual({ tray: ['a', 'migrated'], grid: [] })
  })

  it('asks the browser to keep the board', async () => {
    const persist = vi.fn(async () => true)
    vi.stubGlobal('navigator', { storage: { persist } })
    expect(await createIndexedDbBoardStore(uniqueName()).requestPersistence()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('reports no persistence where the browser has no way to ask', async () => {
    vi.stubGlobal('navigator', {})
    expect(await createIndexedDbBoardStore(uniqueName()).requestPersistence()).toBe(false)
    vi.unstubAllGlobals()
  })
})
