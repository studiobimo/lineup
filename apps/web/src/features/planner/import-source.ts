/** Anywhere images can come from. A new source is a small adapter in front of the same pipeline. */
export interface ImportSource {
  files(): Promise<File[]>
}

export const IMAGE_LIMIT = 300

// Browsers that cannot decode these leave the type empty, and a browser that can should get to try.
const IMAGE_EXTENSION = /\.(hei[cf]|avif)$/i

export function isImage(file: File) {
  return file.type.startsWith('image/') || IMAGE_EXTENSION.test(file.name)
}

export interface ImportPlan {
  accepted: File[]
  ignored: number
  overLimit: number
}

/** One check for every path: nothing about a limit or a file type lives in a source. */
export function planImport(files: File[], boardSize: number): ImportPlan {
  const images = files.filter(isImage)
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

/** readEntries gives a batch at a time, and an empty one at the end. */
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

/** A dropped folder arrives as one nameless file, so the entries are what has to be read. */
export function fromDrop(items: DataTransferItemList): ImportSource {
  // The list empties as soon as the drop event ends, so this has to happen before any await.
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
