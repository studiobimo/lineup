import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import type { StoredImage } from './board-store'
import { fakeDirectory } from './fake-directory'
import { copyBoard, createFolderBoardStore } from './folder-board-store'

const image = (id: string, original?: Blob): StoredImage => ({
  id,
  width: 3,
  height: 4,
  createdAt: '2026-11-01T12:00:00Z',
  thumbnail: new Blob([`thumbnail of ${id}`]),
  publish: new Blob([`publish copy of ${id}`]),
  original
})

const photo = (name: string, text = name) => new File([text], name, { type: 'image/jpeg' })

describe('a folder board', () => {
  it('keeps the original untouched, under its own name, beside the app’s copies', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a', photo('beach.jpg', 'the full-size original')))

    expect(await files.get('beach.jpg')?.text()).toBe('the full-size original')
    expect(await (await store.getThumbnail('a'))?.text()).toBe('thumbnail of a')
    expect(await (await store.getPublishCopy('a'))?.text()).toBe('publish copy of a')
    expect((await store.listImages())[0]).toMatchObject({ fileName: 'beach.jpg', missing: false })
  })

  it('never overwrites a file, even for two images that arrive together', async () => {
    const { handle, files } = fakeDirectory()
    files.set('beach.jpg', photo('beach.jpg', 'already here'))
    const store = await createFolderBoardStore(handle)
    await Promise.all([
      store.putImage(image('a', photo('beach.jpg', 'first'))),
      store.putImage(image('b', photo('beach.jpg', 'second')))
    ])

    expect(await files.get('beach.jpg')?.text()).toBe('already here')
    expect(await files.get('beach (2).jpg')?.text()).toBe('first')
    expect(await files.get('beach (3).jpg')?.text()).toBe('second')
  })

  it('finds what it holds when it is opened again', async () => {
    const { handle } = fakeDirectory()
    const first = await createFolderBoardStore(handle)
    expect(await first.hasBoard()).toBe(false)
    await first.putImage(image('a', photo('a.jpg')))
    await first.saveBoard({ tray: ['a'], grid: [] })
    await first.saveHistory({ past: [{ tray: [], grid: [] }], future: [] })
    await first.setColour('a', {
      dominant: { lightness: 0.5, chroma: 0.1, hue: 30 },
      palette: [],
      tone: 0.5,
      vivid: 0.2
    })

    const second = await createFolderBoardStore(handle)
    expect(await second.hasBoard()).toBe(true)
    expect(await second.loadBoard()).toEqual({ tray: ['a'], grid: [] })
    expect((await second.loadHistory()).past).toHaveLength(1)
    expect((await second.listImages())[0].colour?.tone).toBe(0.5)
  })

  it('starts empty in a folder with no board', async () => {
    const store = await createFolderBoardStore(fakeDirectory().handle)
    expect(await store.loadBoard()).toEqual({ tray: [], grid: [] })
    expect(await store.loadHistory()).toEqual({ past: [], future: [] })
    expect(await store.listImages()).toEqual([])
    expect(await store.getThumbnail('nothing')).toBeUndefined()
  })

  it('refuses to open on a file of its own that it cannot trust', async () => {
    const { handle } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.saveBoard({ tray: [], grid: [] })
    const data = await handle.getDirectoryHandle('.lineup')

    await writeTo(data, 'board.json', 'not json')
    await expect(createFolderBoardStore(handle)).rejects.toThrow(SyntaxError)
    await writeTo(data, 'board.json', '{"tray":"not a list"}')
    await expect(createFolderBoardStore(handle)).rejects.toThrow(ZodError)
  })

  it('says when an original has gone, and when it comes back', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a', photo('a.jpg')))
    const original = files.get('a.jpg')!

    files.delete('a.jpg')
    expect((await store.listImages())[0].missing).toBe(true)
    files.set('a.jpg', original)
    expect((await store.listImages())[0].missing).toBe(false)
  })

  it('leaves the original when an image is deleted, and does not offer it again', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a', photo('a.jpg')))
    await store.deleteImages(['a'])

    expect(files.has('a.jpg')).toBe(true)
    expect(await store.listImages()).toEqual([])
    expect(await store.getThumbnail('a')).toBeUndefined()
    expect(await store.newFiles()).toEqual([])

    const reopened = await createFolderBoardStore(handle)
    expect(await reopened.newFiles()).toEqual([])
  })

  it('can offer what was removed again, and counts only what is still there', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a', photo('a.jpg')))
    await store.putImage(image('b', photo('b.jpg')))
    await store.deleteImages(['a', 'b'])
    files.delete('b.jpg')
    expect(await store.countForgotten()).toBe(1)

    await store.remember()
    expect(await store.countForgotten()).toBe(0)
    expect((await store.newFiles()).map(({ name }) => name)).toEqual(['a.jpg'])

    const reopened = await createFolderBoardStore(handle)
    expect((await reopened.newFiles()).map(({ name }) => name)).toEqual(['a.jpg'])
  })

  it('deletes only the files it was told to forget, and counts them', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a', photo('a.jpg')))
    await store.putImage(image('b', photo('b.jpg')))
    await store.putImage(image('c', photo('c.jpg')))
    await store.deleteImages(['a', 'b'])

    expect(await store.deleteForgotten()).toBe(2)
    expect([...files.keys()].filter((name) => name.endsWith('.jpg'))).toEqual(['c.jpg'])
    expect(await store.countForgotten()).toBe(0)
    expect(await store.deleteForgotten()).toBe(0)
    expect((await store.listImages()).map(({ id }) => id)).toEqual(['c'])

    const reopened = await createFolderBoardStore(handle)
    expect(await reopened.newFiles()).toEqual([])
  })

  it('offers what appeared, leaves hidden files alone, and looks in subfolders', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a', photo('a.jpg')))
    files.set('new.jpg', photo('new.jpg'))
    files.set('.DS_Store', photo('.DS_Store'))
    const trip = await handle.getDirectoryHandle('trip', { create: true })
    await writeTo(trip, 'beach.jpg')

    expect((await store.newFiles()).map(({ name }) => name).sort()).toEqual([
      'beach.jpg',
      'new.jpg'
    ])
  })

  it('records a file that was already here where it is, with no second copy', async () => {
    const { handle, files } = fakeDirectory()
    files.set('new.jpg', photo('new.jpg'))
    const store = await createFolderBoardStore(handle)
    const [found] = await store.newFiles()
    await store.putImage(image('a', found))

    expect([...files.keys()].filter((name) => name.endsWith('.jpg'))).toEqual(['new.jpg'])
    expect((await store.listImages())[0].fileName).toBe('new.jpg')
    expect(await store.newFiles()).toEqual([])
  })

  it('gives a restored image, which has no original, its publish copy', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a'))
    expect(await files.get('a.jpg')?.text()).toBe('publish copy of a')
  })

  it('copies a board in whole, and leaves the one it came from as it was', async () => {
    const from = await createFolderBoardStore(fakeDirectory('browser').handle)
    await from.putImage(image('a'))
    await from.saveBoard({ tray: ['a'], grid: [] })
    await from.saveHistory({ past: [{ tray: [], grid: [] }], future: [] })
    const { handle } = fakeDirectory()
    const to = await createFolderBoardStore(handle)
    await copyBoard(from, to)

    expect(await to.hasBoard()).toBe(true)
    expect(await to.loadBoard()).toEqual({ tray: ['a'], grid: [] })
    expect((await to.loadHistory()).past).toHaveLength(1)
    expect(await (await to.getThumbnail('a'))?.text()).toBe('thumbnail of a')
    expect(await from.loadBoard()).toEqual({ tray: ['a'], grid: [] })
  })

  it('does not repeat an original when a copy that stopped is run again', async () => {
    const { handle, files } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    await store.putImage(image('a'))
    await store.putImage(image('a'))
    expect(files.has('a (2).jpg')).toBe(false)
  })

  it('turns a burst of saves into a few writes, ending on the latest', async () => {
    const { handle } = fakeDirectory()
    const store = await createFolderBoardStore(handle)
    const saves = Array.from({ length: 50 }, (_, index) =>
      store.saveBoard({ tray: [`${index}`], grid: [] })
    )
    await Promise.all(saves)
    expect(await store.loadBoard()).toEqual({ tray: ['49'], grid: [] })
  })
})

async function writeTo(directory: FileSystemDirectoryHandle, name: string, bytes = 'bytes') {
  const handle = await directory.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
}
