import i18n from './config'

// The catalogs too long, or too rarely needed, for the first load. A namespace here is also left
// out of the eager glob in config.ts. Cast rather than glob<...>(, for the reason given there.
const catalogs = import.meta.glob(
  [
    '../locales/*/albums.json',
    '../locales/*/legal.json',
    '../locales/*/planner.json',
    '../locales/*/settings.json'
  ],
  { import: 'default' }
) as Record<string, () => Promise<object>>

type LazyNamespace = 'albums' | 'legal' | 'planner' | 'settings'

/** Every language's strings for what is about to show them. */
export async function loadStrings(namespace: LazyNamespace) {
  const files = Object.entries(catalogs).filter(([path]) => path.endsWith(`/${namespace}.json`))
  await Promise.all(
    files.map(async ([path, load]) => {
      const [language] = path.split('/').slice(-2)
      i18n.addResourceBundle(language, namespace, await load())
    })
  )
}
