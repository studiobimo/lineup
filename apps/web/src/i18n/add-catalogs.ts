import i18n from './config'

/** For a catalog too long to be in the first load: what import.meta.glob found, by language. */
export async function addCatalogs(
  namespace: string,
  catalogs: Record<string, () => Promise<object>>
) {
  await Promise.all(
    Object.entries(catalogs).map(async ([path, load]) => {
      const [language] = path.split('/').slice(-2)
      i18n.addResourceBundle(language, namespace, await load())
    })
  )
}
