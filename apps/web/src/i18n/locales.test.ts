import { describe, expect, it } from 'vitest'

import { defaultLanguage, resources } from './config'

const keys = (catalog: object, prefix = ''): string[] =>
  Object.entries(catalog)
    .flatMap(([key, value]) =>
      value && typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]
    )
    .sort()

describe('locales', () => {
  const source = resources[defaultLanguage]

  it(`has catalogs for the default language, ${defaultLanguage}`, () => {
    expect(source).toBeDefined()
  })

  const others = Object.keys(resources).filter((language) => language !== defaultLanguage)
  it.each(others)(
    `%s has the namespaces and keys ${defaultLanguage} has, and no more`,
    (language) => {
      expect(Object.keys(resources[language]).sort()).toEqual(Object.keys(source).sort())
      for (const namespace of Object.keys(source)) {
        expect(keys(resources[language][namespace] ?? {})).toEqual(keys(source[namespace]))
      }
    }
  )
})
