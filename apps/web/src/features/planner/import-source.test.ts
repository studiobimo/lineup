import { describe, expect, it } from 'vitest'

import { fromDrop, fromFiles, planImport } from './import-source'

const image = (name = 'a.jpg') => new File(['x'], name, { type: 'image/jpeg' })
const text = () => new File(['x'], 'notes.txt', { type: 'text/plain' })

describe('planImport', () => {
  it('ignores what is not an image', () => {
    expect(planImport([image(), text()], 0)).toMatchObject({ ignored: 1, overLimit: 0 })
  })

  it('keeps a type the browser left blank, so the decoder can have its say', () => {
    const heic = new File(['x'], 'photo.HEIC', { type: '' })
    expect(planImport([heic], 0).accepted).toEqual([heic])
  })

  it('takes the videos Instagram would take, by type or by name, and no other', () => {
    const mp4 = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    const mov = new File(['x'], 'clip.MOV', { type: '' })
    const webm = new File(['x'], 'clip.webm', { type: 'video/webm' })
    expect(planImport([mp4, mov, webm], 0)).toMatchObject({ accepted: [mp4, mov], ignored: 1 })
  })

  it('stops at 300 across tray and grid, in the order the files came', () => {
    const files = [image('1.jpg'), image('2.jpg'), image('3.jpg')]
    const plan = planImport(files, 298)
    expect(plan.accepted).toEqual(files.slice(0, 2))
    expect(plan.overLimit).toBe(1)
  })

  it('takes nothing at the limit, or past it', () => {
    expect(planImport([image()], 300)).toMatchObject({ accepted: [], overLimit: 1 })
    expect(planImport([image()], 301)).toMatchObject({ accepted: [], overLimit: 1 })
  })
})

describe('sources', () => {
  it('reads a list of files', async () => {
    const file = image()
    expect(await fromFiles([file]).files()).toEqual([file])
  })

  it('walks a dropped folder and its subfolders, past one batch of entries', async () => {
    const fileEntry = (file: File) => ({
      isFile: true,
      file: (done: (f: File) => void) => done(file)
    })
    const directory = (batches: unknown[][]) => ({
      isFile: false,
      createReader: () => ({
        readEntries: (done: (entries: unknown[]) => void) => done(batches.shift() ?? [])
      })
    })
    const [a, b, c] = [image('a.jpg'), image('b.jpg'), image('c.jpg')]
    const nested = directory([[fileEntry(c)]])
    const dropped = directory([[fileEntry(a)], [fileEntry(b), nested]])
    const items = [
      { kind: 'file', webkitGetAsEntry: () => dropped, getAsFile: () => null },
      { kind: 'string', webkitGetAsEntry: () => null, getAsFile: () => null }
    ] as unknown as DataTransferItemList

    expect(await fromDrop(items).files()).toEqual([a, b, c])
  })

  it('takes the file itself where the browser gives no entry for it', async () => {
    const file = image()
    const items = [
      { kind: 'file', webkitGetAsEntry: () => null, getAsFile: () => file }
    ] as unknown as DataTransferItemList
    expect(await fromDrop(items).files()).toEqual([file])
  })

  it('reads the entries before the drop event ends', () => {
    let read = false
    const items = [
      {
        kind: 'file',
        webkitGetAsEntry: () => null,
        getAsFile: () => {
          read = true
          return null
        }
      }
    ] as unknown as DataTransferItemList
    fromDrop(items)
    expect(read).toBe(true)
  })
})
