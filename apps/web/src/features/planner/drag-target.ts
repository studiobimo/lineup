import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import type { Container } from './board'
import type { Board } from './board-store'

export interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

export interface Point {
  x: number
  y: number
}

export type Side = 'before' | 'after'

/** Where a dragged cell would land. The drop and its indicator both go by this. */
export type DropTarget =
  | { kind: 'swap'; id: string }
  | {
      kind: 'insert'
      container: Container
      index: number
      /** The cell to draw the line against. An empty container has none. */
      beside?: { id: string; side: Side }
    }

/** What is under the pointer: a cell, or the empty part of a container. */
export interface Hover {
  id: string
  container: Container
  isCell: boolean
}

interface Aim {
  board: Board
  active: string
  hover: Hover | null
  point: Point | null
  inserting: boolean
  boxOf: (id: string) => Box | undefined
}

const distance = (box: Box, { x, y }: Point) =>
  Math.hypot(x - (box.left + box.right) / 2, y - (box.top + box.bottom) / 2)

/** The cells read left to right, so past the end of a row or below it counts as after. */
function sideOf(box: Box, { x, y }: Point): Side {
  if (y > box.bottom) return 'after'
  if (y < box.top) return 'before'
  return x > (box.left + box.right) / 2 ? 'after' : 'before'
}

export function dropTarget({ board, active, hover, point, inserting, boxOf }: Aim) {
  if (!hover || !point) return null
  if (hover.isCell && !inserting) {
    return hover.id === active ? null : ({ kind: 'swap', id: hover.id } satisfies DropTarget)
  }

  const { container } = hover
  const cells = board[container].filter((id) => id !== active)
  let nearest: { id: string; index: number; box: Box } | undefined
  cells.forEach((id, index) => {
    const box = boxOf(id)
    if (box && (!nearest || distance(box, point) < distance(nearest.box, point))) {
      nearest = { id, index, box }
    }
  })
  if (!nearest) return { kind: 'insert', container, index: 0 } satisfies DropTarget

  const side = sideOf(nearest.box, point)
  return {
    kind: 'insert',
    container,
    index: nearest.index + (side === 'after' ? 1 : 0),
    beside: { id: nearest.id, side }
  } satisfies DropTarget
}

export const dragStore = createStore<{ target: DropTarget | null }>(() => ({ target: null }))

/** Only the cells the indicator is on change, so the other 299 do not render on every move. */
export function useDropMark(id: string) {
  return useStore(dragStore, ({ target }) => {
    if (target?.kind === 'swap') return target.id === id ? 'swap' : null
    return target?.beside?.id === id ? target.beside.side : null
  })
}

export function useEmptyAreaMark(container: Container) {
  return useStore(
    dragStore,
    ({ target }) => target?.kind === 'insert' && !target.beside && target.container === container
  )
}
