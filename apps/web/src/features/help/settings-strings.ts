import { addCatalogs } from '@/i18n/add-catalogs'

// Cast rather than glob<...>(, for the reason given in i18n/config.ts.
const catalogs = import.meta.glob('../../locales/*/settings.json', {
  import: 'default'
}) as Record<string, () => Promise<object>>

/** Mostly long notes, so they come with the dialog that shows them, not in the first load. */
export const loadSettingsStrings = () => addCatalogs('settings', catalogs)
