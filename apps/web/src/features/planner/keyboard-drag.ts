import { type DroppableContainer, KeyboardCode, type KeyboardCoordinateGetter } from '@dnd-kit/core'

import { type Box, centreOf, type Direction, nearestInDirection } from './drag-target'

const directions: Partial<Record<string, Direction>> = {
  [KeyboardCode.Left]: 'left',
  [KeyboardCode.Right]: 'right',
  [KeyboardCode.Up]: 'up',
  [KeyboardCode.Down]: 'down'
}

function cellBoxes(containers: DroppableContainer[]) {
  return containers.flatMap(({ data, node }): Box[] => {
    const box = data.current?.isCell ? node.current?.getBoundingClientRect() : undefined
    return box ? [box] : []
  })
}

export const stepBetweenCells: KeyboardCoordinateGetter = ({ code }, { context }) => {
  const direction = directions[code]
  const { collisionRect, droppableContainers } = context
  if (!direction || !collisionRect) return undefined
  const cells = cellBoxes(droppableContainers.getEnabled())
  const next = nearestInDirection(collisionRect, direction, cells)
  if (!next) return undefined
  const { x, y } = centreOf(next)
  return { x: x - collisionRect.width / 2, y: y - collisionRect.height / 2 }
}
