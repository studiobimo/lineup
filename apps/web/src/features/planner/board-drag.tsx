import {
  type CollisionDetection,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Trans } from 'react-i18next'

import { Kbd } from '@/components/ui/kbd'

import { CellFlights } from './cell-flights'
import { DragGhost } from './drag-ghost'
import {
  cellBox,
  dragStore,
  dropTarget,
  type DropTarget,
  ground,
  type Hover,
  launch,
  type Point
} from './drag-target'
import { plannerStore } from './planner'
import { useDragGhost } from './use-drag-ghost'

// Dragging a pixel or two is a click that wobbled, and cells hold buttons.
const PICK_UP_DISTANCE = 6
// On touch a finger that moves at once is scrolling the page, so a drag starts from a held press.
const LONG_PRESS = { delay: 250, tolerance: 8 }

// #14 gives these their words. Until then the library would read out each cell's id.
const quiet = () => undefined
const announcements = {
  onDragStart: quiet,
  onDragOver: quiet,
  onDragEnd: quiet,
  onDragCancel: quiet
}

const touchPoint = ({ clientX, clientY }: Touch): Point => ({ x: clientX, y: clientY })

function place(id: string, target: DropTarget) {
  const { swap, move } = plannerStore.getState()
  if (target.kind === 'swap') swap(id, target.id)
  else move(id, target.container, target.index)
}

interface Latest {
  active: string | null
  hover: Hover | null
  point: Point | null
  inserting: boolean
}

export function BoardDrag({ children }: { children: ReactNode }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: PICK_UP_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: LONG_PRESS })
  )
  const ghost = useDragGhost()
  const { lift, follow, land } = ghost
  const [active, setActive] = useState<string | null>(null)
  const latest = useRef<Latest>({ active: null, hover: null, point: null, inserting: false })
  const boxes = useRef<(id: string) => DOMRect | undefined>(() => undefined)

  const aim = useCallback(() => {
    const { active, hover, point, inserting } = latest.current
    if (!active) return
    const { board } = plannerStore.getState()
    const target = dropTarget({ board, active, hover, point, inserting, boxOf: boxes.current })
    dragStore.setState({ target })
  }, [])

  // Asks the page what is under the pointer. Rectangles measured beforehand would go stale beside
  // a sticky tray as the page scrolls, and would count cells that the tray has clipped.
  const collide = useCallback<CollisionDetection>(({ droppableContainers, pointerCoordinates }) => {
    const find = (id: unknown) => droppableContainers.find((droppable) => droppable.id === id)
    boxes.current = (id) => find(id)?.node.current?.getBoundingClientRect()
    latest.current.point = pointerCoordinates
    if (!pointerCoordinates) return []

    const { x, y } = pointerCoordinates
    const under = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-id]')
    const droppable = find(under?.dataset.dropId)
    const data = droppable?.data.current as Omit<Hover, 'id'> | undefined
    if (!droppable || !data) {
      latest.current.hover = null
      return []
    }
    latest.current.hover = { id: String(droppable.id), ...data }
    return [{ id: droppable.id, data: { droppableContainer: droppable, value: 0 } }]
  }, [])

  useEffect(() => {
    if (!active) return
    const shift = ({ shiftKey }: KeyboardEvent) => {
      latest.current.inserting = shiftKey
      aim()
    }
    // Straight from the event rather than through React, so the ghost keeps up with the pointer.
    const mouse = ({ clientX, clientY }: MouseEvent) => follow({ x: clientX, y: clientY })
    const touch = ({ touches: [finger] }: TouchEvent) => follow(touchPoint(finger))
    window.addEventListener('keydown', shift)
    window.addEventListener('keyup', shift)
    window.addEventListener('mousemove', mouse)
    window.addEventListener('touchmove', touch)
    return () => {
      window.removeEventListener('keydown', shift)
      window.removeEventListener('keyup', shift)
      window.removeEventListener('mousemove', mouse)
      window.removeEventListener('touchmove', touch)
    }
  }, [active, aim, follow])

  const release = (apply: boolean) => {
    const { target } = dragStore.getState()
    const { active: id } = latest.current
    latest.current.active = null
    dragStore.setState({ target: null })
    setActive(null)
    if (!id) return
    launch([id])
    if (apply && target) place(id, target)
    // The board has changed but the page has not, until React has committed it.
    requestAnimationFrame(() => land(cellBox(id), () => ground([id])))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      accessibility={{ announcements }}
      onDragStart={({ active: { id }, activatorEvent }) => {
        const cell = String(id)
        const event = activatorEvent as MouseEvent | TouchEvent
        const from = cellBox(cell)
        latest.current.active = cell
        latest.current.inserting = event.shiftKey
        setActive(cell)
        if (from) {
          const point =
            'touches' in event
              ? touchPoint(event.touches[0])
              : { x: event.clientX, y: event.clientY }
          lift(cell, point, from)
        }
      }}
      onDragMove={aim}
      onDragEnd={() => release(true)}
      onDragCancel={() => release(false)}
    >
      {children}
      <CellFlights />
      <DragGhost ghost={ghost} />
      {active && (
        <p className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md pointer-coarse:hidden">
          <Trans i18nKey="planner:dragHint" components={{ key: <Kbd /> }} />
        </p>
      )}
    </DndContext>
  )
}
