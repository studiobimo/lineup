import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { site } from '@/config/site'

type Catalog = Record<string, unknown>

// Every catalog in src/locales/<language>/<namespace>.json, so a new language or namespace
// is a new file and nothing here changes. They are small enough to bundle: no loading state.
// Cast rather than glob<Catalog>(: Vitest only knows not to cache a file whose glob results
// can change when it finds the text import.meta.glob( in it.
const catalogs = import.meta.glob('../locales/*/*.json', {
  eager: true,
  import: 'default'
}) as Record<string, Catalog>

export const resources: Record<string, Record<string, Catalog>> = {}
for (const [path, catalog] of Object.entries(catalogs)) {
  const [language, file] = path.split('/').slice(-2)
  resources[language] = { ...resources[language], [file.replace(/\.json$/, '')]: catalog }
}

/** The language of site.locale. Its catalogs are the source the others are held to. */
export const defaultLanguage = site.locale.split('_')[0]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: Object.keys(resources),
    defaultNS: 'common',
    // React escapes what it renders.
    interpolation: { escapeValue: false },
    initAsync: false,
    detection: { order: ['querystring', 'localStorage', 'navigator'], caches: ['localStorage'] },
    // A key with no string is a bug: a test that renders it fails, the dev server warns.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (_languages, namespace, key) => {
      const message = `i18n: no string for ${namespace}:${key}`
      if (import.meta.env.MODE === 'test') throw new Error(message)
      console.warn(message)
    }
  })

// Screen readers pick their pronunciation from <html lang>, which index.html only starts.
const setLang = (language: string) => (document.documentElement.lang = language)
setLang(i18n.resolvedLanguage ?? defaultLanguage)
i18n.on('languageChanged', setLang)

export default i18n
