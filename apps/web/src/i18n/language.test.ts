import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n, { defaultLanguage, languages, setLanguage } from './config'
import { dateTimeFormat } from './format'

afterEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage(defaultLanguage)
})

describe('setLanguage', () => {
  it('offers the default language first, then the others', () => {
    expect(languages[0]).toBe(defaultLanguage)
    expect(languages).toContain('es')
  })

  it('switches the strings, the page language and what follows the app, and remembers it', () => {
    setLanguage('es')
    expect(i18n.t('close')).toBe('Cerrar')
    expect(document.documentElement.lang).toBe('es')
    expect(localStorage.getItem('language')).toBe('es')
    expect(dateTimeFormat({ month: 'long' }).format(new Date(2026, 10, 2))).toBe('noviembre')
  })
})

describe('the language the app starts in', () => {
  async function startWith(browserLanguages: string[], saved?: string) {
    vi.resetModules()
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(browserLanguages)
    if (saved) localStorage.setItem('language', saved)
    return (await import('./config')).default.language
  }

  afterEach(() => vi.restoreAllMocks())

  it('follows the browser to the first language that has strings', async () => {
    expect(await startWith(['fr-FR', 'es-MX', 'en-US'])).toBe('es')
  })

  it('falls back to the default when the browser asks for none we have', async () => {
    expect(await startWith(['fr-FR'])).toBe(defaultLanguage)
  })

  it('prefers the language chosen in the app', async () => {
    expect(await startWith(['es-ES'], 'en')).toBe('en')
  })

  it('ignores a saved language it has no strings for', async () => {
    expect(await startWith(['es-ES'], 'xx')).toBe('es')
  })
})
