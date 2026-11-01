import {
  type CollisionDetection,
  DndContext,
  DragOverlay,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Trans } from 'react-i18next'

import { Kbd } from '@/components/ui/kbd'

import { dragStore, dropTarget, type Hover, type Point } from './drag-target'
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { Thumbnail } from './thumbnail'

const { width, height } = instagram.cellRatio

// Dragging a pixel or two is a click that wobbled, and cells hold buttons.
const PICK_UP_DISTANCE = 6

// A cell-sized overlay would sit on the very spot the drop indicator has to show.
const OVERLAY_OFFSET = 12
const besidePointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect) return transform
  const { clientX, clientY } = activatorEvent as PointerEvent
  return {
    ...transform,
    x: transform.x + clientX - draggingNodeRect.left + OVERLAY_OFFSET,
    y: transform.y + clientY - draggingNodeRect.top + OVERLAY_OFFSET
  }
}

// #14 gives these their words. Until then the library would read out each cell's id.
const quiet = () => undefined
const announcements = {
  onDragStart: quiet,
  onDragOver: quiet,
  onDragEnd: quiet,
  onDragCancel: quiet
}

interface Latest {
  active: string | null
  hover: Hover | null
  point: Point | null
  inserting: boolean
}

export function BoardDrag({ children }: { children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: PICK_UP_DISTANCE } })
  )
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
    const follow = ({ shiftKey }: KeyboardEvent) => {
      latest.current.inserting = shiftKey
      aim()
    }
    window.addEventListener('keydown', follow)
    window.addEventListener('keyup', follow)
    return () => {
      window.removeEventListener('keydown', follow)
      window.removeEventListener('keyup', follow)
    }
  }, [active, aim])

  const finish = () => {
    setActive(null)
    latest.current.active = null
    dragStore.setState({ target: null })
  }

  const drop = () => {
    const { target } = dragStore.getState()
    const { active } = latest.current
    finish()
    if (!active || !target) return
    const { swap, move } = plannerStore.getState()
    if (target.kind === 'swap') swap(active, target.id)
    else move(active, target.container, target.index)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      accessibility={{ announcements }}
      onDragStart={({ active: { id }, activatorEvent }) => {
        latest.current.active = String(id)
        latest.current.inserting = (activatorEvent as PointerEvent).shiftKey
        setActive(String(id))
      }}
      onDragMove={aim}
      onDragEnd={drop}
      onDragCancel={finish}
    >
      {children}
      <DragOverlay
        dropAnimation={null}
        modifiers={[besidePointer]}
        style={{ pointerEvents: 'none' }}
      >
        {active && (
          <div
            aria-hidden
            className="w-24 overflow-hidden rounded-sm bg-muted shadow-lg ring-1 ring-black/10"
            style={{ aspectRatio: `${width} / ${height}` }}
          >
            <Thumbnail id={active} label="" />
          </div>
        )}
      </DragOverlay>
      {active && (
        <p className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md pointer-coarse:hidden">
          <Trans i18nKey="planner:dragHint" components={{ key: <Kbd /> }} />
        </p>
      )}
    </DndContext>
  )
}
