import {
  type CollisionDetection,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { Kbd } from '@/components/ui/kbd'

import { CellFlights } from './cell-flights'
import { dragAnnouncements } from './drag-announcements'
import { DragGhost } from './drag-ghost'
import {
  type Box,
  cellBox,
  centreOf,
  dragStore,
  dropTarget,
  type DropTarget,
  ground,
  type Hover,
  launch,
  type Point
} from './drag-target'
import { InsertLine } from './insert-line'
import { stepBetweenCells } from './keyboard-drag'
import { plannerStore } from './planner'
import { useDragGhost } from './use-drag-ghost'

// Dragging a pixel or two is a click that wobbled, and cells hold buttons.
const PICK_UP_DISTANCE = 6
// On touch a finger that moves at once is scrolling the page, so a drag starts from a held press.
const LONG_PRESS = { delay: 250, tolerance: 8 }

const pointOf = ({ clientX, clientY }: MouseEvent | Touch): Point => ({ x: clientX, y: clientY })

/** Where a drag starts. Keys have no position, so it starts from the cell. */
function startOf(event: MouseEvent | TouchEvent | KeyboardEvent, cell: Box) {
  if ('touches' in event) return pointOf(event.touches[0])
  return 'clientX' in event ? pointOf(event) : centreOf(cell)
}

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
  const { t } = useTranslation('planner')
  const accessibility = useMemo(
    () => ({
      announcements: dragAnnouncements(t),
      screenReaderInstructions: { draggable: t('dragInstructions') }
    }),
    [t]
  )
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: PICK_UP_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: LONG_PRESS }),
    useSensor(KeyboardSensor, { coordinateGetter: stepBetweenCells })
  )
  const ghost = useDragGhost()
  const { lift, follow, glide, land } = ghost
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
  const collide = useCallback<CollisionDetection>((args) => {
    const { collisionRect, droppableContainers, pointerCoordinates } = args
    const find = (id: unknown) => droppableContainers.find((droppable) => droppable.id === id)
    boxes.current = (id) => find(id)?.node.current?.getBoundingClientRect()
    // A keyboard drag has no pointer, so it aims from the middle of the cell it is carrying.
    const point = pointerCoordinates ?? centreOf(collisionRect)
    latest.current.point = point

    const { x, y } = point
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
    const mouse = (event: MouseEvent) => follow(pointOf(event))
    const touch = ({ touches: [finger] }: TouchEvent) => follow(pointOf(finger))
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
    dragStore.setState({ dragging: false, target: null })
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
      accessibility={accessibility}
      onDragStart={({ active: { id }, activatorEvent }) => {
        const cell = String(id)
        const event = activatorEvent as MouseEvent | TouchEvent | KeyboardEvent
        const from = cellBox(cell)
        latest.current.active = cell
        latest.current.inserting = event.shiftKey
        dragStore.setState({ dragging: true })
        setActive(cell)
        if (from) lift(cell, startOf(event, from), from)
      }}
      onDragMove={({ active: { rect }, activatorEvent }) => {
        const { translated } = rect.current
        if (activatorEvent instanceof KeyboardEvent && translated) glide(centreOf(translated))
        aim()
      }}
      onDragEnd={() => release(true)}
      onDragCancel={() => release(false)}
    >
      {children}
      <CellFlights />
      <InsertLine />
      <DragGhost ghost={ghost} />
      {active && (
        <p className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md pointer-coarse:hidden">
          <Trans i18nKey="planner:dragHint" components={{ key: <Kbd /> }} />
        </p>
      )}
    </DndContext>
  )
}
