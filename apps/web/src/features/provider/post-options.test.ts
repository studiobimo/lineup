import { describe, expect, it } from 'vitest'

import { toAltTexts } from './post-options'

const slides = [
  { id: 'a', video: false },
  { id: 'b', video: true },
  { id: 'c', video: false }
]

describe('toAltTexts', () => {
  it('keeps a description for each picture, trimmed, by slide', () => {
    expect(toAltTexts([' A cat ', '', 'A dog'], slides)).toEqual(['A cat', '', 'A dog'])
  })

  it('drops what was typed for a video', () => {
    expect(toAltTexts(['', 'A clip', ''], slides)).toBeUndefined()
    expect(toAltTexts(['A cat', 'A clip'], slides)).toEqual(['A cat', '', ''])
  })

  it('sends nothing when nothing was written', () => {
    expect(toAltTexts([], slides)).toBeUndefined()
    expect(toAltTexts(['  '], slides)).toBeUndefined()
  })
})
