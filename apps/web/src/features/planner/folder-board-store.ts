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

// The folder's layout is in ADR-0015. Originals sit where a person can see them, and everything
// the app makes for itself sits in here, so it never looks like one of their photos.
const DATA_FOLDER = '.lineup'

export interface FolderBoardStore extends BoardStore {
  folderName: string
  hasBoard(): Promise<boolean>
  /** Files in the folder the board has not seen, or been told to forget. */
  newFiles(): Promise<File[]>
}

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
  // The browser writes to a side file and swaps it in on close, so a crash leaves the old one.
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
}

/** One JSON file. Writes that pile up while one runs become the latest, so a burst costs one. */
function jsonFile<Value>(directory: FileSystemDirectoryHandle, name: string, empty: Value) {
  let latest = empty
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
      if (!handle) return empty
      return JSON.parse(await (await handle.getFile()).text()) as Value
    },
    write(value: Value) {
      latest = value
      dirty = true
      writing ??= drain()
      return writing
    }
  }
}

/** Every file a person can see, by its path in the folder. Hidden ones are not theirs to plan. */
async function* walk(
  directory: FileSystemDirectoryHandle,
  prefix = ''
): AsyncGenerator<[string, FileSystemFileHandle]> {
  for await (const [name, handle] of directory.entries()) {
    if (name.startsWith('.')) continue
    if (handle.kind === 'file') yield [`${prefix}${name}`, handle as FileSystemFileHandle]
    else yield* walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`)
  }
}

/** `photo.jpg`, or `photo (2).jpg` if that is taken: a person's file is never overwritten. */
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
  const boardFile = jsonFile<Board>(data, 'board.json', emptyBoard)
  const historyFile = jsonFile<History>(data, 'history.json', emptyHistory)
  const imagesFile = jsonFile<ImageRecord[]>(data, 'images.json', [])
  const forgottenFile = jsonFile<string[]>(data, 'forgotten.json', [])

  const records = new Map((await imagesFile.read()).map((record) => [record.id, record]))
  const forgotten = new Set(await forgottenFile.read())
  // What newFiles handed out, so a file already here is recorded where it is and not copied.
  const alreadyHere = new WeakMap<Blob, string>()
  // One at a time, so that two images with one name cannot both find it free.
  let adding = Promise.resolve()

  const saveRecords = () => imagesFile.write([...records.values()])

  const readFrom = async (directory: FileSystemDirectoryHandle, id: string) => {
    const handle = await orUndefined(directory.getFileHandle(`${id}.jpg`))
    return handle?.getFile()
  }

  const writeTo = async (directory: FileSystemDirectoryHandle, id: string, bytes: Blob) =>
    writeFile(await directory.getFileHandle(`${id}.jpg`, { create: true }), bytes)

  async function keepOriginal({ id, original, publish }: StoredImage) {
    const known = (original && alreadyHere.get(original)) ?? records.get(id)?.fileName
    if (known) return known
    // A backup holds no originals, so its copy is the best this image will ever have.
    const name = original instanceof File ? original.name : `${id}.jpg`
    const free = await freeName(folder, name)
    await writeFile(await folder.getFileHandle(free, { create: true }), original ?? publish)
    return free
  }

  async function add(image: StoredImage) {
    const fileName = await keepOriginal(image)
    await writeTo(thumbnails, image.id, image.thumbnail)
    await writeTo(publishCopies, image.id, image.publish)
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

    loadBoard: () => boardFile.read(),
    saveBoard: (board) => boardFile.write(board),
    loadHistory: () => historyFile.read(),
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
    getPublishCopy: (id) => readFrom(publishCopies, id),

    /** The app's copies go. The original stays, and is not offered again. */
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
        // The browser's own side file can be gone by the time this gets to it.
        const file = await orUndefined(handle.getFile())
        if (!file) continue
        alreadyHere.set(file, path)
        files.push(file)
      }
      return files
    },

    // The folder is the person's disk, so it has no quota to report or browser to persuade.
    storageUsage: async () => ({ used: 0, quota: 0 }),
    requestPersistence: async () => true
  }
}

/** History too, so that undo still works. The board goes last: its file means the copy finished. */
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
