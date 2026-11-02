import { useStore } from 'zustand'

import { createStoredStore } from '@/lib/stored-store'

/** Both off unless asked for: these are personal data the planner otherwise never keeps. */
export interface ImportSettings {
  readCaptureDates: boolean
  readLocations: boolean
}

const { store, save } = createStoredStore<ImportSettings>('import-settings', (saved) => ({
  readCaptureDates: saved.readCaptureDates === true,
  readLocations: saved.readLocations === true
}))

export const useImportSettings = () => useStore(store)

export const importSettings = () => store.getState()

export const saveImportSettings = save
