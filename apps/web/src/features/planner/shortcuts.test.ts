import { describe, expect, it } from 'vitest'

import { shortcutFor } from './shortcuts'

const keys = (key: string, held: Partial<KeyboardEvent> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...held
})

describe('shortcutFor', () => {
  it('undoes with Command or Control and Z', () => {
    expect(shortcutFor(keys('z', { metaKey: true }))).toBe('undo')
    expect(shortcutFor(keys('z', { ctrlKey: true }))).toBe('undo')
  })

  it('redoes with Shift added, or with Control and Y', () => {
    expect(shortcutFor(keys('Z', { metaKey: true, shiftKey: true }))).toBe('redo')
    expect(shortcutFor(keys('y', { ctrlKey: true }))).toBe('redo')
  })

  it('leaves everything else alone', () => {
    expect(shortcutFor(keys('z'))).toBeNull()
    expect(shortcutFor(keys('z', { metaKey: true, altKey: true }))).toBeNull()
    expect(shortcutFor(keys('a', { metaKey: true }))).toBeNull()
  })
})
