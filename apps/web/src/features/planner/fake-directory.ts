/** Enough of the File System Access API to test a folder store, which jsdom does not have. */
export function fakeDirectory(name = 'photos') {
  const files = new Map<string, File>()
  const directories = new Map<string, FileSystemDirectoryHandle>()
  const notFound = () => new DOMException('Not found', 'NotFoundError')
  const writes = { count: 0 }

  const fileHandle = (fileName: string) =>
    ({
      kind: 'file',
      name: fileName,
      getFile: async () => files.get(fileName),
      createWritable: async () => {
        let content: Blob | string = ''
        return {
          write: async (bytes: Blob | string) => {
            content = bytes
          },
          close: async () => {
            writes.count += 1
            files.set(fileName, new File([content], fileName, { type: 'image/jpeg' }))
          }
        }
      }
    }) as unknown as FileSystemFileHandle

  const handle = {
    kind: 'directory',
    name,
    getFileHandle: async (fileName: string, { create = false } = {}) => {
      if (!files.has(fileName) && !create) throw notFound()
      if (!files.has(fileName)) files.set(fileName, new File([], fileName))
      return fileHandle(fileName)
    },
    getDirectoryHandle: async (directory: string, { create = false } = {}) => {
      if (!directories.has(directory) && !create) throw notFound()
      if (!directories.has(directory)) directories.set(directory, fakeDirectory(directory).handle)
      return directories.get(directory)
    },
    removeEntry: async (entry: string) => {
      if (!files.delete(entry)) throw notFound()
    },
    entries: async function* () {
      for (const fileName of files.keys()) yield [fileName, fileHandle(fileName)]
      for (const entry of directories) yield entry
    }
  } as unknown as FileSystemDirectoryHandle

  return { handle, files, writes }
}
