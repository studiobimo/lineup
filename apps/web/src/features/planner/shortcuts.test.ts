import { describe, expect, it } from 'vitest'

import { shortcutFor, cellStep } from './shortcuts'

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

describe('cellStep', () => {
  it.each([
    ['ArrowRight', 4, 5],
    ['ArrowLeft', 4, 3],
    ['ArrowDown', 4, 7],
    ['ArrowUp', 4, 1],
    ['Home', 4, 0],
    ['End', 4, 8]
  ])('%s from the middle of a three by three grid', (key, from, to) => {
    expect(cellStep(key, from, 9, 3)).toBe(to)
  })

  it('stops at the edges rather than wrapping', () => {
    expect(cellStep('ArrowLeft', 0, 9, 3)).toBeNull()
    expect(cellStep('ArrowRight', 8, 9, 3)).toBeNull()
    expect(cellStep('ArrowUp', 1, 9, 3)).toBeNull()
    expect(cellStep('ArrowDown', 7, 9, 3)).toBeNull()
  })

  it('stays put on a short last row', () => {
    expect(cellStep('ArrowDown', 5, 7, 3)).toBeNull()
  })

  it('leaves every other key alone', () => {
    expect(cellStep('a', 4, 9, 3)).toBeNull()
  })
})
