import { useStore } from 'zustand'

import { createIndexedDbBoardStore } from './indexeddb-board-store'
import { createPlannerStore, type PlannerState } from './planner-store'

export const boardStore = createIndexedDbBoardStore()
export const plannerStore = createPlannerStore(boardStore)

export function usePlanner<T>(selector: (state: PlannerState) => T) {
  return useStore(plannerStore, selector)
}
