import { addCatalogs } from '@/i18n/add-catalogs'

// Cast rather than glob<...>(, for the reason given in i18n/config.ts.
const catalogs = import.meta.glob('../../locales/*/legal.json', {
  import: 'default'
}) as Record<string, () => Promise<object>>

/** The longest catalog and the least read, so it comes with its route, not in the first load. */
export const loadLegalStrings = () => addCatalogs('legal', catalogs)
