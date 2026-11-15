import { useMemo } from 'react'

import { type Container, isPublished, plannedCells } from './board'
import { usePlanner } from './planner'
import { useTabStop } from './tab-stop'

// The cell that holds the tab stop. A published grid cell is drawn after the planned ones, so it ~keep
// takes the stop only when it was the one focused, or when nothing is planned.
export function useTabStopCell(container: Container) {
  const focused = useTabStop(container)
  const cells = usePlanner((state) => state.board[container])
  const posts = usePlanner((state) => state.board.posts)
  const first = useMemo(
    () =>
      container === 'grid'
        ? (cells.find((id) => !isPublished({ tray: [], grid: cells, posts }, id)) ?? cells[0])
        : cells[0],
    [container, cells, posts]
  )
  return focused && cells.includes(focused) ? focused : first
}

export function usePlannedCells(container: Container) {
  const cells = usePlanner((state) => state.board[container])
  const posts = usePlanner((state) => state.board.posts)
  return useMemo(
    () => (container === 'grid' ? plannedCells({ tray: [], grid: cells, posts }) : cells),
    [container, cells, posts]
  )
}
