import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { type Container, isLocked } from './board'
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

export type Direction = 'left' | 'right' | 'up' | 'down'

interface Beside {
  id: string
  side: Side
}

export type DropTarget =
  | { kind: 'swap' | 'group'; id: string }
  | {
      kind: 'insert'
      container: Container
      index: number
      beside?: Beside
    }

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
  dwelling: string | null
  boxOf: (id: string) => Box | undefined
}

const INSERT_EDGE = 0.2

export const centreOf = ({ left, right, top, bottom }: Box): Point => ({
  x: (left + right) / 2,
  y: (top + bottom) / 2
})

function distance(box: Box, { x, y }: Point) {
  const centre = centreOf(box)
  return Math.hypot(x - centre.x, y - centre.y)
}

export function nearestInDirection(from: Box, direction: Direction, boxes: Box[]) {
  const sideways = direction === 'left' || direction === 'right'
  const sign = direction === 'left' || direction === 'up' ? -1 : 1
  const start = centreOf(from)
  let nearest: { box: Box; cost: number } | undefined
  for (const box of boxes) {
    const { x, y } = centreOf(box)
    const ahead = (sideways ? x - start.x : y - start.y) * sign
    const off = Math.abs(sideways ? y - start.y : x - start.x)
    const cost = ahead + off * 2
    if (ahead > 1 && (!nearest || cost < nearest.cost)) nearest = { box, cost }
  }
  return nearest?.box
}

function sideOf(box: Box, { x, y }: Point): Side {
  if (y > box.bottom) return 'after'
  if (y < box.top) return 'before'
  return x > (box.left + box.right) / 2 ? 'after' : 'before'
}

function nearSideEdge({ left, right }: Box, { x }: Point) {
  const edge = (right - left) * INSERT_EDGE
  return x < left + edge || x > right - edge
}

export function dropTarget({ board, active, hover, point, inserting, dwelling, boxOf }: Aim) {
  if (!hover || !point) return null
  if (hover.isCell && !inserting && !isLocked(board, hover.id)) {
    if (hover.id === active) return null
    const box = boxOf(hover.id)
    if (!box || !nearSideEdge(box, point)) {
      const kind = dwelling === hover.id ? 'group' : 'swap'
      return { kind, id: hover.id } satisfies DropTarget
    }
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

interface DragState {
  dragging: boolean
  target: DropTarget | null
  albumFull: boolean
  airborne: ReadonlySet<string>
}

export const dragStore = createStore<DragState>(() => ({
  dragging: false,
  target: null,
  albumFull: false,
  airborne: new Set()
}))

export const useAirborne = (id: string) => useStore(dragStore, ({ airborne }) => airborne.has(id))

export function launch(ids: string[]) {
  dragStore.setState(({ airborne }) => ({ airborne: new Set([...airborne, ...ids]) }))
}

export function ground(ids: string[]) {
  dragStore.setState(({ airborne }) => ({
    airborne: new Set([...airborne].filter((id) => !ids.includes(id)))
  }))
}

export const cellElement = (id: string) => document.querySelector(`[data-drop-id="${id}"]`)

export const cellBox = (id: string) => cellElement(id)?.getBoundingClientRect()

export function gapBeside({ id, side }: Beside) {
  const cell = cellElement(id)
  if (!cell) return undefined
  const { left, right, top, height } = cell.getBoundingClientRect()
  const before = side === 'before'
  const neighbour = (
    before ? cell.previousElementSibling : cell.nextElementSibling
  )?.getBoundingClientRect()
  const edge = before ? left : right
  const x = neighbour?.top === top ? (edge + (before ? neighbour.right : neighbour.left)) / 2 : edge
  return { x, top, height }
}

export function useDropMark(id: string) {
  return useStore(dragStore, ({ target }) => {
    if (!target) return null
    if (target.kind !== 'insert') return target.id === id ? target.kind : null
    return target.beside?.id === id ? target.beside.side : null
  })
}

export function useEmptyAreaMark(container: Container) {
  return useStore(
    dragStore,
    ({ target }) => target?.kind === 'insert' && !target.beside && target.container === container
  )
}
