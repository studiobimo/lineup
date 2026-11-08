import i18n from './config'

const catalogs = import.meta.glob(
  [
    '../locales/*/albums.json',
    '../locales/*/legal.json',
    '../locales/*/planner.json',
    '../locales/*/provider.json',
    '../locales/*/settings.json'
  ],
  { import: 'default' }
) as Record<string, () => Promise<object>>

type LazyNamespace = 'albums' | 'legal' | 'planner' | 'provider' | 'settings'

export async function loadStrings(namespace: LazyNamespace) {
  const files = Object.entries(catalogs).filter(([path]) => path.endsWith(`/${namespace}.json`))
  await Promise.all(
    files.map(async ([path, load]) => {
      const [language] = path.split('/').slice(-2)
      i18n.addResourceBundle(language, namespace, await load())
    })
  )
}
