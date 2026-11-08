import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import i18n from '@/i18n/config'
import { lastingToast } from '@/lib/lasting-toast'

import { imagesOn } from './board'
import { importImages } from './import-images'
import { IMAGE_LIMIT, type ImportSource, planImport } from './import-source'
import { boardStore, plannerStore } from './planner'
import { bestEffort } from '@/lib/best-effort'

interface ImportState {
  progress: { done: number; total: number } | null
  run(source: ImportSource): Promise<void>
}

const importStore = createStore<ImportState>((set, get) => ({
  progress: null,

  async run(source) {
    if (get().progress) return
    try {
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
          bestEffort(() => adding.finish())
          throw error
        }
        adding.finish()
        void boardStore.requestPersistence().catch(() => undefined)
      }

      const skipped = [
        plan.ignored > 0 && i18n.t('planner:notImages', { count: plan.ignored }),
        failed > 0 && i18n.t('planner:unreadable', { count: failed }),
        plan.overLimit > 0 &&
          i18n.t('planner:overLimit', { count: plan.overLimit, limit: IMAGE_LIMIT })
      ].filter(Boolean)
      if (skipped.length > 0) {
        lastingToast({ type: 'warning', title: skipped.join(' ') })
      }
    } catch (error) {
      lastingToast(
        isStorageFull(error)
          ? {
              type: 'error',
              title: i18n.t('planner:storageFull'),
              description: i18n.t('planner:storageFullHelp')
            }
          : { type: 'error', title: i18n.t('planner:importFailed') }
      )
    } finally {
      set({ progress: null })
    }
  }
}))

export const isStorageFull = (error: unknown) =>
  error instanceof DOMException && error.name === 'QuotaExceededError'

export const runImport = (source: ImportSource) => importStore.getState().run(source)

export const useImportProgress = () => useStore(importStore, (state) => state.progress)
