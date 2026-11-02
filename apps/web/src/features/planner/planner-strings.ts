import { addCatalogs } from '@/i18n/add-catalogs'

// Cast rather than glob<...>(, for the reason given in i18n/config.ts.
const catalogs = import.meta.glob('../../locales/*/planner.json', {
  import: 'default'
}) as Record<string, () => Promise<object>>

/** The planner's route waits for these, and the legal pages never need them. */
export const loadPlannerStrings = () => addCatalogs('planner', catalogs)
