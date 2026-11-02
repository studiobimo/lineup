import { backfillColours } from '@/features/autosort/backfill-colours'

import { plannerStore } from './planner'

/** Asked of the window and not a store, so that a browser without it loads no folder code. */
export const supportsFolders = () => 'showDirectoryPicker' in window

/** What every way into a board comes down to, so that the folder is settled before it is read. */
export async function openBoard() {
  let folders: typeof import('./folder-board') | undefined
  try {
    if (supportsFolders()) {
      folders = await import('./folder-board')
      if (!(await folders.reopenFolder())) {
        plannerStore.setState({ session: 'folder' })
        return
      }
    }
  } catch {
    plannerStore.setState({ loadFailed: true })
    return
  }
  await plannerStore.getState().load()
  if (plannerStore.getState().loadFailed) return
  // Neither is needed to use the board, and both have another go at the next load.
  await Promise.allSettled([backfillColours(), folders?.offerNewFiles()])
}
