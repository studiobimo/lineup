type FolderAccess = 'granted' | 'denied' | 'prompt'

interface FileSystemHandle {
  queryPermission(options: { mode: 'readwrite' }): Promise<FolderAccess>
  requestPermission(options: { mode: 'readwrite' }): Promise<FolderAccess>
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
}

interface Window {
  showDirectoryPicker?(options: {
    id?: string
    mode: 'readwrite'
  }): Promise<FileSystemDirectoryHandle>
}
