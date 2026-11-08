import { z } from 'zod'

import { boardSchema, historySchema, imageRecordSchema } from './board-schema'
import {
  type Board,
  type BoardStore,
  emptyBoard,
  emptyHistory,
  type History,
  type ImageRecord,
  type StoredImage,
  toRecord
} from './board-store'

const DATA_FOLDER = '.lineup'

export interface FolderBoardStore extends BoardStore {
  folderName: string
  hasBoard(): Promise<boolean>
  newFiles(): Promise<File[]>
  countForgotten(): Promise<number>
  remember(): Promise<void>
  deleteForgotten(): Promise<number>
}

const storedRecordSchema = imageRecordSchema.extend({ fileName: z.string().optional() })

const isMissing = (error: unknown) =>
  error instanceof DOMException && error.name === 'NotFoundError'

async function orUndefined<Found>(reading: Promise<Found>) {
  try {
    return await reading
  } catch (error) {
    if (isMissing(error)) return undefined
    throw error
  }
}

async function writeFile(handle: FileSystemFileHandle, bytes: Blob | string) {
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
}

function jsonFile<Value>(
  directory: FileSystemDirectoryHandle,
  name: string,
  schema: z.ZodType<Value>
) {
  let latest: Value
  let dirty = false
  let writing: Promise<void> | undefined

  async function drain() {
    try {
      while (dirty) {
        dirty = false
        const handle = await directory.getFileHandle(name, { create: true })
        await writeFile(handle, JSON.stringify(latest))
      }
    } finally {
      writing = undefined
    }
  }

  return {
    async read() {
      const handle = await orUndefined(directory.getFileHandle(name))
      if (!handle) return undefined
      return schema.parse(JSON.parse(await (await handle.getFile()).text()))
    },
    write(value: Value) {
      latest = value
      dirty = true
      writing ??= drain()
      return writing
    }
  }
}

async function* walk(
  directory: FileSystemDirectoryHandle,
  prefix = ''
): AsyncGenerator<[string, FileSystemFileHandle, FileSystemDirectoryHandle]> {
  for await (const [name, handle] of directory.entries()) {
    if (name.startsWith('.')) continue
    if (handle.kind === 'file') {
      yield [`${prefix}${name}`, handle as FileSystemFileHandle, directory]
    } else yield* walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`)
  }
}

async function fileAt(folder: FileSystemDirectoryHandle, path: string) {
  const steps = path.split('/')
  const name = steps.pop() ?? ''
  let directory = folder
  for (const step of steps) {
    const next = await orUndefined(directory.getDirectoryHandle(step))
    if (!next) return undefined
    directory = next
  }
  const handle = await orUndefined(directory.getFileHandle(name))
  return handle && orUndefined(handle.getFile())
}

const VIDEO_EXTENSION = { 'video/mp4': 'mp4', 'video/quicktime': 'mov' } as const

async function freeName(folder: FileSystemDirectoryHandle, name: string) {
  const dot = name.lastIndexOf('.')
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let copy = 1; ; copy += 1) {
    const candidate = copy === 1 ? name : `${stem} (${copy})${extension}`
    if (!(await orUndefined(folder.getFileHandle(candidate)))) return candidate
  }
}

export async function createFolderBoardStore(
  folder: FileSystemDirectoryHandle
): Promise<FolderBoardStore> {
  const data = await folder.getDirectoryHandle(DATA_FOLDER, { create: true })
  const thumbnails = await data.getDirectoryHandle('thumbnails', { create: true })
  const publishCopies = await data.getDirectoryHandle('publish', { create: true })
  const boardFile = jsonFile<Board>(data, 'board.json', boardSchema)
  const historyFile = jsonFile<History>(data, 'history.json', historySchema)
  const imagesFile = jsonFile<ImageRecord[]>(data, 'images.json', z.array(storedRecordSchema))
  const forgottenFile = jsonFile<string[]>(data, 'forgotten.json', z.array(z.string()))

  const [, , savedRecords, savedForgotten] = await Promise.all([
    boardFile.read(),
    historyFile.read(),
    imagesFile.read(),
    forgottenFile.read()
  ])
  const records = new Map(savedRecords?.map((record) => [record.id, record]))
  const forgotten = new Set(savedForgotten)
  const alreadyHere = new WeakMap<Blob, string>()
  let adding = Promise.resolve()

  const saveRecords = () => imagesFile.write([...records.values()])

  const readFrom = async (directory: FileSystemDirectoryHandle, id: string) => {
    const handle = await orUndefined(directory.getFileHandle(`${id}.jpg`))
    return handle?.getFile()
  }

  const writeTo = async (directory: FileSystemDirectoryHandle, id: string, bytes: Blob) =>
    writeFile(await directory.getFileHandle(`${id}.jpg`, { create: true }), bytes)

  async function keepOriginal({ id, original, publish, video }: StoredImage) {
    const known = (original && alreadyHere.get(original)) ?? records.get(id)?.fileName
    if (known) return known
    const extension = video ? VIDEO_EXTENSION[video.type] : 'jpg'
    const name = original instanceof File ? original.name : `${id}.${extension}`
    const free = await freeName(folder, name)
    await writeFile(await folder.getFileHandle(free, { create: true }), original ?? publish)
    return free
  }

  async function add(image: StoredImage) {
    const fileName = await keepOriginal(image)
    await writeTo(thumbnails, image.id, image.thumbnail)
    if (!image.video) await writeTo(publishCopies, image.id, image.publish)
    records.set(image.id, { ...toRecord(image), fileName })
    await saveRecords()
  }

  const removeFrom = (directory: FileSystemDirectoryHandle, id: string) =>
    orUndefined(directory.removeEntry(`${id}.jpg`))

  return {
    folderName: folder.name,

    async hasBoard() {
      return (await orUndefined(data.getFileHandle('board.json'))) !== undefined
    },

    loadBoard: async () => (await boardFile.read()) ?? emptyBoard,
    saveBoard: (board) => boardFile.write(board),
    loadHistory: async () => (await historyFile.read()) ?? emptyHistory,
    saveHistory: (history) => historyFile.write(history),

    async listImages() {
      const present = new Set<string>()
      for await (const [path] of walk(folder)) present.add(path)
      return [...records.values()].map((record) => ({
        ...record,
        missing: !present.has(record.fileName ?? '')
      }))
    },

    putImage(image) {
      const added = adding.then(() => add(image))
      adding = added.catch(() => undefined)
      return added
    },

    async setColour(id, colour) {
      const record = records.get(id)
      if (!record) return
      records.set(id, { ...record, colour })
      await saveRecords()
    },

    getThumbnail: (id) => readFrom(thumbnails, id),
    async getPublishCopy(id) {
      const record = records.get(id)
      if (!record?.video) return readFrom(publishCopies, id)
      const original = record.fileName && (await fileAt(folder, record.fileName))
      return original ? original.slice(0, original.size, record.video.type) : undefined
    },

    async deleteImages(ids) {
      for (const id of ids) {
        const fileName = records.get(id)?.fileName
        if (fileName) forgotten.add(fileName)
        records.delete(id)
        await Promise.all([removeFrom(thumbnails, id), removeFrom(publishCopies, id)])
      }
      await Promise.all([saveRecords(), forgottenFile.write([...forgotten])])
    },

    async newFiles() {
      const known = new Set([...records.values()].map(({ fileName }) => fileName))
      const files: File[] = []
      for await (const [path, handle] of walk(folder)) {
        if (known.has(path) || forgotten.has(path)) continue
        const file = await orUndefined(handle.getFile())
        if (!file) continue
        alreadyHere.set(file, path)
        files.push(file)
      }
      return files
    },

    async countForgotten() {
      let count = 0
      for await (const [path] of walk(folder)) if (forgotten.has(path)) count += 1
      return count
    },

    async remember() {
      forgotten.clear()
      await forgottenFile.write([])
    },

    async deleteForgotten() {
      const doomed: [FileSystemDirectoryHandle, string][] = []
      for await (const [path, , parent] of walk(folder)) {
        if (forgotten.has(path)) doomed.push([parent, path.slice(path.lastIndexOf('/') + 1)])
      }
      for (const [parent, name] of doomed) await orUndefined(parent.removeEntry(name))
      forgotten.clear()
      await forgottenFile.write([])
      return doomed.length
    },

    storageUsage: async () => ({ used: 0, quota: 0 }),
    requestPersistence: async () => true
  }
}

export async function copyBoard(from: BoardStore, to: BoardStore) {
  for (const record of await from.listImages()) {
    const [thumbnail, publish] = await Promise.all([
      from.getThumbnail(record.id),
      from.getPublishCopy(record.id)
    ])
    if (thumbnail && publish) await to.putImage({ ...record, thumbnail, publish })
  }
  await to.saveHistory(await from.loadHistory())
  await to.saveBoard(await from.loadBoard())
}
