import i18n, { defaultLanguage } from './config'

const formats = new Map<string, Intl.DateTimeFormat>()

/** Dates and times in the language the app shows, which can differ from the browser's own. */
export function dateTimeFormat(options: Intl.DateTimeFormatOptions) {
  const language = i18n.resolvedLanguage ?? defaultLanguage
  const key = `${language}:${JSON.stringify(options)}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(language, options)
    formats.set(key, format)
  }
  return format
}
