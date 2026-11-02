import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { boardJournal } from './board-journal'

const board = { tray: ['a'], grid: ['b'] }

describe('the board journal', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('holds a board until it is cleared', () => {
    boardJournal.write(board)
    expect(boardJournal.read()).toEqual(board)
    boardJournal.clear()
    expect(boardJournal.read()).toBeUndefined()
  })

  it('reads as empty rather than throw on something it did not write', () => {
    localStorage.setItem('lineup-unsaved-board', 'not json')
    expect(boardJournal.read()).toBeUndefined()
    localStorage.setItem('lineup-unsaved-board', '{"tray":"a"}')
    expect(boardJournal.read()).toBeUndefined()
  })

  it('drops an older board rather than keep it when storage is full', () => {
    boardJournal.write(board)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    boardJournal.write({ tray: [], grid: [] })
    expect(boardJournal.read()).toBeUndefined()
  })

  it('does nothing when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('Blocked', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    expect(() => boardJournal.write(board)).not.toThrow()
    expect(boardJournal.read()).toBeUndefined()
    expect(() => boardJournal.clear()).not.toThrow()
  })
})
