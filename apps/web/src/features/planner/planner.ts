import { useStore } from 'zustand'

import type { BoardStore } from './board-store'
import { createIndexedDbBoardStore } from './indexeddb-board-store'
import { createPlannerStore, type PlannerState } from './planner-store'

let folderStore: BoardStore | undefined

export const boardStore = new Proxy(createIndexedDbBoardStore(), {
  get: (browserStore, method: keyof BoardStore) => (folderStore ?? browserStore)[method]
})
export const plannerStore = createPlannerStore(boardStore)

export const setFolderStore = (store: BoardStore | undefined) => {
  folderStore = store
}

export function usePlanner<T>(selector: (state: PlannerState) => T) {
  return useStore(plannerStore, selector)
}
