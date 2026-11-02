import { addCatalogs } from '@/i18n/add-catalogs'

// Cast rather than glob<...>(, for the reason given in i18n/config.ts.
const catalogs = import.meta.glob('../../locales/*/albums.json', {
  import: 'default'
}) as Record<string, () => Promise<object>>

/** They come with the dialog that shows them, not in the first load. */
export const loadAlbumStrings = () => addCatalogs('albums', catalogs)
