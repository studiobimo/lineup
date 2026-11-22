import { outOfOrder } from '@/features/planner/board'
import { plannerStore } from '@/features/planner/planner'

import { fromFieldTime } from './post-time'

export const isMisordered = (cell: string, when: string) =>
  !Number.isNaN(Date.parse(when)) &&
  outOfOrder(plannerStore.getState().board, cell, fromFieldTime(when))
