import { backfillColours } from '@/features/autosort/backfill-colours'

import { plannerStore } from './planner'

export const supportsFolders = () => 'showDirectoryPicker' in window

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
  await Promise.allSettled([backfillColours(), folders?.offerNewFiles()])
}
