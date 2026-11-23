import { createImageWorker, runInWorker } from '@/features/planner/import-images'
import { boardStore, plannerStore } from '@/features/planner/planner'

import type { ImageColour } from './colour'

export async function backfillColours(createWorker = createImageWorker) {
  const pending = Object.values(plannerStore.getState().images).filter(
    ({ colour }) => colour?.tone === undefined
  )
  if (pending.length === 0) return
  const worker = createWorker()
  try {
    for (const { id } of pending) {
      if (plannerStore.getState().session !== 'active') return
      const file = await boardStore.getThumbnail(id)
      if (!file) continue
      const colour = await runInWorker<ImageColour>(worker, { kind: 'colour', file }).catch(
        () => null
      )
      if (colour) plannerStore.getState().setColour(id, colour)
    }
  } finally {
    worker.terminate()
  }
}
