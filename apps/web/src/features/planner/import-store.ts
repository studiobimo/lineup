import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { toastManager } from '@/components/ui/toast'
import i18n from '@/i18n/config'

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
      const { board } = plannerStore.getState()
      const plan = planImport(await source.files(), board.tray.length + board.grid.length)
      let failed = 0
      if (plan.accepted.length > 0) {
        set({ progress: { done: 0, total: plan.accepted.length } })
        const result = await importImages(plan.accepted, {
          onProgress: (done, total) => set({ progress: { done, total } })
        })
        failed = result.failed
        await plannerStore.getState().addImages(result.images)
        // After an import, when the browser has a reason to say yes.
        void boardStore.requestPersistence()
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

const isStorageFull = (error: unknown) =>
  error instanceof DOMException && error.name === 'QuotaExceededError'

export const runImport = (source: ImportSource) => importStore.getState().run(source)

export const useImportProgress = () => useStore(importStore, (state) => state.progress)
