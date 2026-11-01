import { createImageWorker, runInWorker } from '@/features/planner/import-images'
import { boardStore, plannerStore } from '@/features/planner/planner'

import type { ImageColour } from './colour'

/**
 * Images from before colours were kept. One at a time and in the worker, so that the page never
 * notices, and each is saved as it is done, so that a reload picks up where this left off.
 */
export async function backfillColours(createWorker = createImageWorker) {
  const pending = Object.values(plannerStore.getState().images).filter(({ colour }) => !colour)
  if (pending.length === 0) return
  const worker = createWorker()
  try {
    for (const { id } of pending) {
      if (plannerStore.getState().session !== 'active') return
      const file = await boardStore.getThumbnail(id)
      if (!file) continue
      // An image this cannot read sorts with those that have no colour, and nothing else suffers.
      const colour = await runInWorker<ImageColour>(worker, { kind: 'colour', file }).catch(
        () => null
      )
      if (colour) plannerStore.getState().setColour(id, colour)
    }
  } finally {
    worker.terminate()
  }
}
