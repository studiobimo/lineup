import { beforeEach, describe, expect, it } from 'vitest'

import { plannerStore } from './planner'
import { clearSelection, clickCell, selectedCells, toggleSelected } from './selection-store'

const plain = { shiftKey: false, metaKey: false, ctrlKey: false }
const withKey = { ...plain, metaKey: true }
const withShift = { ...plain, shiftKey: true }

describe('the selection', () => {
  beforeEach(() => {
    plannerStore.setState({ board: { tray: ['a', 'b', 'c', 'd'], grid: ['e'] } })
    clearSelection()
  })

  it('ignores a plain click until something is selected, and then takes them all', () => {
    clickCell('a', plain)
    expect(selectedCells()).toEqual([])
    clickCell('a', withKey)
    clickCell('b', plain)
    expect(selectedCells()).toEqual(['a', 'b'])
    clickCell('a', plain)
    expect(selectedCells()).toEqual(['b'])
  })

  it('selects a range from the last cell chosen, either way along', () => {
    clickCell('c', withKey)
    clickCell('a', withShift)
    expect(selectedCells().sort()).toEqual(['a', 'b', 'c'])
  })

  it('takes a Shift-click with nothing to measure from as one cell', () => {
    clickCell('b', withShift)
    expect(selectedCells()).toEqual(['b'])
  })

  it('does not reach across containers with a range', () => {
    clickCell('a', withKey)
    clickCell('e', withShift)
    expect(selectedCells().sort()).toEqual(['a', 'e'])
  })

  it('lets go of a cell that leaves the board', () => {
    toggleSelected('a')
    toggleSelected('b')
    plannerStore.setState({ board: { tray: ['b'], grid: [] } })
    expect(selectedCells()).toEqual(['b'])
  })
})
