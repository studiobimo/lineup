import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { site } from '@/config/site'
import { bestEffort } from '@/lib/best-effort'

type Catalog = Record<string, unknown>

const catalogs = import.meta.glob(
  [
    '../locales/*/*.json',
    '!../locales/*/albums.json',
    '!../locales/*/legal.json',
    '!../locales/*/planner.json',
    '!../locales/*/provider.json',
    '!../locales/*/settings.json'
  ],
  { eager: true, import: 'default' }
) as Record<string, Catalog>

export const resources: Record<string, Record<string, Catalog>> = {}
for (const [path, catalog] of Object.entries(catalogs)) {
  const [language, file] = path.split('/').slice(-2)
  resources[language] = { ...resources[language], [file.replace(/\.json$/, '')]: catalog }
}

export const defaultLanguage = site.locale.split('_')[0]

export const languages = Object.keys(resources).sort((a, b) =>
  a === defaultLanguage ? -1 : b === defaultLanguage ? 1 : a.localeCompare(b)
)

const storageKey = 'language'

function savedLanguage() {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function startingLanguage() {
  const wanted = [savedLanguage(), ...navigator.languages].map((tag) => tag?.split('-')[0])
  return wanted.find((language) => language && languages.includes(language)) ?? defaultLanguage
}

export function setLanguage(language: string) {
  bestEffort(() => localStorage.setItem(storageKey, language))
  void i18n.changeLanguage(language)
}

void i18n.use(initReactI18next).init({
  resources,
  lng: startingLanguage(),
  fallbackLng: defaultLanguage,
  supportedLngs: Object.keys(resources),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  initAsync: false,
  // A key with no string is a bug: a test that renders it fails, the dev server warns.
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (_languages, namespace, key) => {
    const message = `i18n: no string for ${namespace}:${key}`
    if (import.meta.env.MODE === 'test') throw new Error(message)
    console.warn(message)
  }
})

const setLang = (language: string) => (document.documentElement.lang = language)
setLang(i18n.resolvedLanguage ?? defaultLanguage)
i18n.on('languageChanged', setLang)

export default i18n
