import i18n, { defaultLanguage } from './config'

export function durationText(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

const formats = new Map<string, Intl.DateTimeFormat>()

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
