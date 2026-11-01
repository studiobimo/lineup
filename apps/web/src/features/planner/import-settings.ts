import { useStore } from 'zustand'

import { createStoredStore } from '@/lib/stored-store'

interface ImportSettings {
  /** Off unless asked for: a capture date is personal data the planner otherwise never keeps. */
  readCaptureDates: boolean
}

const { store, save } = createStoredStore<ImportSettings>('import-settings', (saved) => ({
  readCaptureDates: saved.readCaptureDates === true
}))

export const useImportSettings = () => useStore(store)

export const importSettings = () => store.getState()

export const saveImportSettings = save
