import { useStore } from 'zustand'

import type { BoardStore } from './board-store'
import { createIndexedDbBoardStore } from './indexeddb-board-store'
import { createPlannerStore, type PlannerState } from './planner-store'

let folderStore: BoardStore | undefined

/** Whichever store holds the board, so that nothing else has to know a folder can. */
export const boardStore = new Proxy(createIndexedDbBoardStore(), {
  get: (browserStore, method: keyof BoardStore) => (folderStore ?? browserStore)[method]
})
export const plannerStore = createPlannerStore(boardStore)

/** Takes effect at the next `load`. Nothing but `reopenFolder` should call it. */
export const setFolderStore = (store: BoardStore | undefined) => {
  folderStore = store
}

export function usePlanner<T>(selector: (state: PlannerState) => T) {
  return useStore(plannerStore, selector)
}
