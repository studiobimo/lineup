import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { containerOf } from './board'
import { plannerStore } from './planner'

interface SelectionState {
  cells: ReadonlySet<string>
  /** Where a Shift-click measures from. */
  anchor: string | null
}

const empty: SelectionState = { cells: new Set(), anchor: null }

const selectionStore = createStore<SelectionState>(() => empty)

/** Each cell asks about itself, so that selecting one renders one and not all 300. */
export const useIsSelected = (cell: string) =>
  useStore(selectionStore, ({ cells }) => cells.has(cell))

export const useSelectionSize = () => useStore(selectionStore, ({ cells }) => cells.size)

export const selectedCells = () => [...selectionStore.getState().cells]

export function toggleSelected(cell: string) {
  selectionStore.setState(({ cells }) => {
    const next = new Set(cells)
    if (!next.delete(cell)) next.add(cell)
    return { cells: next, anchor: cell }
  })
}

/** Everything from the anchor to `cell`, added to what is selected. A range spans one container. */
function selectRange(cell: string) {
  const { cells, anchor } = selectionStore.getState()
  const { board } = plannerStore.getState()
  const container = containerOf(board, cell)
  const from = anchor ? board[container].indexOf(anchor) : -1
  if (from < 0) {
    toggleSelected(cell)
    return
  }
  const to = board[container].indexOf(cell)
  const range = board[container].slice(Math.min(from, to), Math.max(from, to) + 1)
  selectionStore.setState({ cells: new Set([...cells, ...range]) })
}

export const clearSelection = () => selectionStore.setState(empty, true)

interface Modifiers {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

/** Once anything is selected a plain click selects too, which is how it works without a keyboard. */
export function clickCell(cell: string, { shiftKey, metaKey, ctrlKey }: Modifiers) {
  if (shiftKey) selectRange(cell)
  else if (metaKey || ctrlKey || selectionStore.getState().cells.size > 0) toggleSelected(cell)
}

// A cell that has left the board cannot be acted on, and a board loaded afresh shares none.
plannerStore.subscribe(({ board }, { board: previous }) => {
  if (board === previous) return
  const { cells, anchor } = selectionStore.getState()
  const placed = new Set([...board.tray, ...board.grid])
  const kept = [...cells].filter((cell) => placed.has(cell))
  if (kept.length === cells.size) return
  selectionStore.setState({
    cells: new Set(kept),
    anchor: anchor && placed.has(anchor) ? anchor : null
  })
})
