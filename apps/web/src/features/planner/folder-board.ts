import { openDB } from 'idb'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { toastManager } from '@/components/ui/toast'
import { loadStrings } from '@/i18n/load-strings'
import i18n from '@/i18n/config'

import { copyBoard, createFolderBoardStore, type FolderBoardStore } from './folder-board-store'
import { fromFiles, isPlannable } from './import-source'
import { runImport } from './import-store'
import { openBoard } from './open-board'
import { boardStore, plannerStore, setFolderStore } from './planner'

const ACCESS = { mode: 'readwrite' } as const

type FolderProblem = 'needs-permission' | 'unreachable' | 'unreadable'

type FolderState = { status: 'none' } | { status: 'open' | FolderProblem; name: string }

const folderState = createStore<FolderState>(() => ({ status: 'none' }))

let openFolder: FolderBoardStore | undefined

// Every call opens it again, because this is read once per page and written once in a blue moon.
const handles = () =>
  openDB('lineup-folder', 1, { upgrade: (db) => db.createObjectStore('handle') })

const readHandle = async (): Promise<FileSystemDirectoryHandle | undefined> =>
  (await handles()).get('handle', 'current')

/** The folder's store, or nothing, having said in `folderState` which it is and why. */
async function connect(handle: FileSystemDirectoryHandle) {
  const { name } = handle
  const say = (status: 'open' | FolderProblem) => folderState.setState({ status, name }, true)
  if ((await handle.queryPermission(ACCESS)) !== 'granted') {
    say('needs-permission')
    return undefined
  }
  try {
    const store = await createFolderBoardStore(handle)
    say('open')
    return store
  } catch (error) {
    // The file system's own errors mean the folder. Anything else means what was found in it.
    say(error instanceof DOMException ? 'unreachable' : 'unreadable')
    return undefined
  }
}

/** Settles which store the board is in. False if the folder has to be dealt with first. */
export async function reopenFolder() {
  const handle = await readHandle()
  if (!handle) folderState.setState({ status: 'none' }, true)
  openFolder = handle && (await connect(handle))
  setFolderStore(openFolder)
  return !handle || openFolder !== undefined
}

/** A write failing may mean the folder has gone, which a retry would never get past. */
async function checkFolder() {
  const handle = openFolder && (await readHandle())
  if (handle && !(await connect(handle))) plannerStore.setState({ session: 'folder' })
}

plannerStore.subscribe(({ saveFailed }, { saveFailed: failedBefore }) => {
  // If this fails too, the failed save still shows, and the retries go on.
  if (saveFailed && !failedBefore) checkFolder().catch(() => undefined)
})

let standingOffer: string | undefined

/** Stays up until it is answered, because the photos will still be there if it is not. */
export async function offerNewFiles() {
  const files = (await openFolder?.newFiles())?.filter(isPlannable) ?? []
  if (files.length === 0) return
  await loadStrings('settings')
  // It would be out of date, and two offers would add the same files twice.
  if (standingOffer) toastManager.close(standingOffer)
  const offer = toastManager.add({
    title: i18n.t('settings:newFiles', { count: files.length }),
    timeout: 0,
    actionProps: {
      children: i18n.t('settings:addNewFiles'),
      onClick: () => {
        toastManager.close(offer)
        void runImport(fromFiles(files))
      }
    }
  })
  standingOffer = offer
}

export const countRemovedFiles = async () => (await openFolder?.countForgotten()) ?? 0

/** For a photo that left the board by mistake, long after undo could bring it back. */
export async function offerRemovedFiles() {
  await openFolder?.remember()
  await offerNewFiles()
}

/** Deletes from the person's disk the photos they removed from the board, once they have said so. */
export const deleteRemovedFiles = async () => (await openFolder?.deleteForgotten()) ?? 0

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
