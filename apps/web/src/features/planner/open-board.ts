import { backfillColours } from '@/features/autosort/backfill-colours'

import { plannerStore } from './planner'

/** Asked of the window and not a store, so that a browser without it loads no folder code. */
export const supportsFolders = () => 'showDirectoryPicker' in window

/** What every way into a board comes down to, so that the folder is settled before it is read. */
export async function openBoard() {
  try {
    const folders = supportsFolders() ? await import('./folder-board') : undefined
    if (folders && !(await folders.reopenFolder())) {
      plannerStore.setState({ session: 'folder' })
      return
    }
    await plannerStore.getState().load()
    await backfillColours()
    await folders?.offerNewFiles()
  } catch {
    plannerStore.setState({ loadFailed: true })
  }
}
