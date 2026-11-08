import { videoTypeOf } from './video-frame'

export interface ImportSource {
  files(): Promise<File[]>
}

export const IMAGE_LIMIT = 300

const IMAGE_EXTENSION = /\.(hei[cf]|avif)$/i

function isImage(file: File) {
  return file.type.startsWith('image/') || IMAGE_EXTENSION.test(file.name)
}

export const isPlannable = (file: File) => isImage(file) || videoTypeOf(file) !== undefined

export interface ImportPlan {
  accepted: File[]
  ignored: number
  overLimit: number
}

export function planImport(files: File[], boardSize: number): ImportPlan {
  const images = files.filter(isPlannable)
  const room = Math.max(0, IMAGE_LIMIT - boardSize)
  return {
    accepted: images.slice(0, room),
    ignored: files.length - images.length,
    overLimit: Math.max(0, images.length - room)
  }
}

export function fromFiles(list: Iterable<File>): ImportSource {
  return { files: async () => [...list] }
}

const entryFile = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject))

async function directoryEntries(directory: FileSystemDirectoryEntry) {
  const reader = directory.createReader()
  const entries: FileSystemEntry[] = []
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    )
    if (batch.length === 0) return entries
    entries.push(...batch)
  }
}

async function walk(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) return [await entryFile(entry as FileSystemFileEntry)]
  const entries = await directoryEntries(entry as FileSystemDirectoryEntry)
  return (await Promise.all(entries.map(walk))).flat()
}

export function fromDrop(items: DataTransferItemList): ImportSource {
  const dropped = [...items]
    .filter((item) => item.kind === 'file')
    .map((item) => ({ entry: item.webkitGetAsEntry(), file: item.getAsFile() }))
  return {
    async files() {
      const found = await Promise.all(
        dropped.map(async ({ entry, file }) => {
          if (entry) return walk(entry)
          return file ? [file] : []
        })
      )
      return found.flat()
    }
  }
}
