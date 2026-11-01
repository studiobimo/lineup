import { openDB } from 'idb'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { copyBoard, createFolderBoardStore } from './folder-board-store'
import { openBoard } from './open-board'
import { boardStore, setFolderStore } from './planner'

const ACCESS = { mode: 'readwrite' } as const

type FolderState =
  { status: 'none' } | { status: 'open' | 'needs-permission' | 'unreachable'; name: string }

const folderState = createStore<FolderState>(() => ({ status: 'none' }))

// Every call opens it again, because this is read once per page and written once in a blue moon.
const handles = () =>
  openDB('lineup-folder', 1, { upgrade: (db) => db.createObjectStore('handle') })

const readHandle = async (): Promise<FileSystemDirectoryHandle | undefined> =>
  (await handles()).get('handle', 'current')

/** Settles which store the board is in. False if the folder has to be dealt with first. */
export async function reopenFolder() {
  const handle = await readHandle()
  if (!handle) {
    setFolderStore(undefined)
    folderState.setState({ status: 'none' }, true)
    return true
  }
  const { name } = handle
  if ((await handle.queryPermission(ACCESS)) !== 'granted') {
    folderState.setState({ status: 'needs-permission', name }, true)
    return false
  }
  try {
    setFolderStore(await createFolderBoardStore(handle))
  } catch {
    // Most likely moved, renamed or on a drive that is not plugged in.
    folderState.setState({ status: 'unreachable', name }, true)
    return false
  }
  folderState.setState({ status: 'open', name }, true)
  return true
}

/** Only from a click: the browser will not ask otherwise. */
export async function askForFolder() {
  const handle = await readHandle()
  if ((await handle?.requestPermission(ACCESS)) === 'granted') await openBoard()
}

/** A folder with a board opens it, and any other takes a copy of the board on screen. */
export async function chooseFolder() {
  const handle = await window.showDirectoryPicker?.({ id: 'lineup', ...ACCESS })
  if (!handle) return
  const folder = await createFolderBoardStore(handle)
  if (!(await folder.hasBoard())) await copyBoard(boardStore, folder)
  await (await handles()).put('handle', handle, 'current')
  await openBoard()
}

/** Back to the board in this browser. The folder stays as it is, and choosing it opens it again. */
export async function leaveFolder() {
  await (await handles()).delete('handle', 'current')
  await openBoard()
}

export const useFolder = () => useStore(folderState)
