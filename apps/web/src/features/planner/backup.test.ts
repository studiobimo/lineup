import { describe, expect, it, vi } from 'vitest'

import { type Backup, createBackup, readBackup } from './backup'
import type { Board, ImageRecord } from './board-store'

const board: Board = { tray: ['a'], grid: ['b'], locked: ['b'] }

const record = (id: string): ImageRecord => ({
  id,
  width: 3,
  height: 4,
  createdAt: '2026-11-01T12:00:00Z',
  takenAt: '2024-05-06T12:00:00.000Z',
  place: 'Miami, US',
  colour: {
    dominant: { lightness: 0.5, chroma: 0.1, hue: 30 },
    palette: [{ lightness: 0.5, chroma: 0.1, hue: 30 }],
    tone: 0.5,
    vivid: 0.2
  }
})

const store = (ids = ['a', 'b', 'only-in-the-history']) => ({
  listImages: async () => ids.map(record),
  getThumbnail: async (id: string) => new Blob([`thumbnail of ${id}`]),
  getPublishCopy: async (id: string) => new Blob([`publish copy of ${id}`])
})

const textOf = async ({ images }: Backup) =>
  Promise.all(
    images.map(async ({ id, thumbnail, publish }) => [
      id,
      await thumbnail.text(),
      await publish.text()
    ])
  )

const reject = (file: Blob) => expect(readBackup(file)).rejects.toThrow()

describe('a backup', () => {
  it('comes back exactly: order, locks, records and bytes', async () => {
    const backup = await readBackup(await createBackup(store(), board))
    expect(backup.board).toEqual(board)
    expect(backup.images.map(({ id }) => id)).toEqual(['a', 'b'])
    expect(backup.images[1]).toMatchObject(record('b'))
    expect(await textOf(backup)).toEqual([
      ['a', 'thumbnail of a', 'publish copy of a'],
      ['b', 'thumbnail of b', 'publish copy of b']
    ])
  })

  it('leaves out what only a folder knows, such as the name of a person’s file', async () => {
    const source = {
      ...store(),
      listImages: async () =>
        ['a', 'b'].map((id) => ({ ...record(id), fileName: 'holiday.jpg', missing: true }))
    }
    const file = await createBackup(source, board)
    expect((await readBackup(file)).images[0]).not.toHaveProperty('fileName')
    expect(await file.text()).not.toContain('holiday')
  })

  it('gives a video back its type', async () => {
    const source = {
      ...store(['a', 'b']),
      listImages: async () => [
        record('a'),
        { ...record('b'), video: { type: 'video/mp4' as const, duration: 4 } }
      ]
    }
    const { images } = await readBackup(await createBackup(source, board))
    expect(images.map(({ publish }) => publish.type)).toEqual(['image/jpeg', 'video/mp4'])
    expect(images[1].video).toEqual({ type: 'video/mp4', duration: 4 })
  })

  it('carries albums, and every image in them', async () => {
    const withAlbum: Board = { tray: ['album'], grid: [], albums: { album: ['a', 'b'] } }
    const backup = await readBackup(await createBackup(store(), withAlbum))
    expect(backup.board).toEqual(withAlbum)
    expect(backup.images.map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('reads a backup made before albums, as a board without them', async () => {
    const manifest = JSON.stringify({
      version: 1,
      board: { tray: ['a'], grid: [] },
      images: [{ ...record('a'), thumbnail: [0, 1], publish: [1, 1] }]
    })
    const length = new DataView(new ArrayBuffer(4))
    length.setUint32(0, new TextEncoder().encode(manifest).length, true)
    const file = new Blob(['LINEUPBK', length, manifest, 'tp'])

    const backup = await readBackup(file)
    expect(backup.board).toEqual({ tray: ['a'], grid: [] })
    expect(await textOf(backup)).toEqual([['a', 't', 'p']])
  })

  it('reads no bytes into the manifest, however large the images', async () => {
    const big = { ...store(), getPublishCopy: async () => new Blob([new Uint8Array(4096)]) }
    const file = await createBackup(big, board)
    const backup = await readBackup(file)
    expect(backup.images[0].publish.size).toBe(4096)
    expect(file.size).toBeGreaterThan(8192)
  })

  it('stops rather than leave an image behind', async () => {
    const broken = { ...store(), getThumbnail: vi.fn(async () => undefined) }
    await expect(createBackup(broken, board)).rejects.toThrow('lost its bytes')
  })

  it('refuses a file that is something else', async () => {
    await reject(new Blob(['not a backup at all, only some text']))
    await reject(new Blob())
  })

  it('refuses a file that was cut short', async () => {
    const file = await createBackup(store(), board)
    await reject(file.slice(0, file.size - 1))
    await reject(file.slice(0, 40))
  })

  it('refuses a manifest that is not what it should be', async () => {
    const file = await createBackup(store(), board)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const text = new TextDecoder().decode(bytes)
    await reject(new Blob([new TextEncoder().encode(text.replace('"version":1', '"version":2'))]))
    await reject(new Blob([new TextEncoder().encode(text.replace('"tray":["a"]', '"tray":["z"]'))]))
  })
})
