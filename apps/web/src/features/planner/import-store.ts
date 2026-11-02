import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { toastManager } from '@/components/ui/toast'
import i18n from '@/i18n/config'

import { imagesOn } from './board'
import { importImages } from './import-images'
import { IMAGE_LIMIT, type ImportSource, planImport } from './import-source'
import { boardStore, plannerStore } from './planner'

interface ImportState {
  progress: { done: number; total: number } | null
  run(source: ImportSource): Promise<void>
}

const importStore = createStore<ImportState>((set, get) => ({
  progress: null,

  async run(source) {
    if (get().progress) return
    try {
      // Files first: a drop's are only there for as long as the event is.
      const files = await source.files()
      await plannerStore.getState().opened()
      const plan = planImport(files, imagesOn(plannerStore.getState().board).length)
      let failed = 0
      if (plan.accepted.length > 0) {
        set({ progress: { done: 0, total: plan.accepted.length } })
        const adding = plannerStore.getState().beginImport()
        try {
          const result = await importImages(plan.accepted, {
            onBatch: adding.add,
            onProgress: (done, total) => set({ progress: { done, total } })
          })
          failed = result.failed
        } catch (error) {
          // What was stored before this stopped is kept, and not left in storage with no cell.
          try {
            adding.finish()
          } catch {
            // The first error is the one to report.
          }
          throw error
        }
        adding.finish()
        // After an import, when the browser has a reason to say yes. A no changes nothing.
        void boardStore.requestPersistence().catch(() => undefined)
      }

      const skipped = [
        plan.ignored > 0 && i18n.t('planner:notImages', { count: plan.ignored }),
        failed > 0 && i18n.t('planner:unreadable', { count: failed }),
        plan.overLimit > 0 &&
          i18n.t('planner:overLimit', { count: plan.overLimit, limit: IMAGE_LIMIT })
      ].filter(Boolean)
      if (skipped.length > 0) {
        toastManager.add({ type: 'warning', title: skipped.join(' ') })
      }
    } catch (error) {
      toastManager.add(
        isStorageFull(error)
          ? {
              type: 'error',
              title: i18n.t('planner:storageFull'),
              description: i18n.t('planner:storageFullHelp')
            }
          : { type: 'error', title: i18n.t('planner:importFailed') }
      )
    } finally {
      // A failed import must not leave the progress set, because that blocks every later one.
      set({ progress: null })
    }
  }
}))

export const isStorageFull = (error: unknown) =>
  error instanceof DOMException && error.name === 'QuotaExceededError'

export const runImport = (source: ImportSource) => importStore.getState().run(source)

export const useImportProgress = () => useStore(importStore, (state) => state.progress)
