import i18n from '@/i18n/config'

// Cast rather than glob<...>(, for the reason given in i18n/config.ts.
const catalogs = import.meta.glob('../../locales/*/legal.json', {
  import: 'default'
}) as Record<string, () => Promise<Record<string, unknown>>>

/** The longest catalog and the least read, so it comes with its route, not in the first load. */
export async function loadLegalStrings() {
  await Promise.all(
    Object.entries(catalogs).map(async ([path, load]) => {
      const [language] = path.split('/').slice(-2)
      i18n.addResourceBundle(language, 'legal', await load())
    })
  )
}
