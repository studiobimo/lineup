import { type CollisionDetection, DndContext } from '@dnd-kit/core'
import { AnimatePresence } from 'motion/react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useStore } from 'zustand'

import { Kbd } from '@/components/ui/kbd'

import { groupProblem } from './board'
import { BottomBar } from './bottom-bar'
import { CellFlights } from './cell-flights'
import { dragAnnouncements, placeOnBoard } from './drag-announcements'
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
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { useCellSensors } from './use-cell-sensors'
import { useDragGhost } from './use-drag-ghost'

const pointOf = ({ clientX, clientY }: MouseEvent | Touch): Point => ({ x: clientX, y: clientY })

function startOf(event: MouseEvent | TouchEvent | KeyboardEvent, cell: Box) {
  if ('touches' in event) return pointOf(event.touches[0])
  return 'clientX' in event ? pointOf(event) : centreOf(cell)
}

function place(id: string, target: DropTarget) {
  const { swap, move, group } = plannerStore.getState()
  if (target.kind === 'group') return group([target.id, id]) ?? id
  if (target.kind === 'insert') move(id, target.container, target.index)
  else swap(id, target.id)
  return id
}

interface Latest {
  active: string | null
  hover: Hover | null
  point: Point | null
  inserting: boolean
  dwelling: string | null
}

const GROUP_DWELL_MS = 600

function DragHint() {
  const { t } = useTranslation('planner')
  const grouping = useStore(dragStore, ({ target }) => target?.kind === 'group')
  const albumFull = useStore(dragStore, (state) => state.albumFull)
  return (
    <BottomBar role="status" className="px-3 py-1.5 text-sm pointer-coarse:hidden">
      {albumFull ? (
        t('groupRefused.tooMany', { limit: instagram.carouselLimit })
      ) : grouping ? (
        t('dropToGroup')
      ) : (
        <Trans i18nKey="planner:dragHint" components={{ key: <Kbd /> }} />
      )}
    </BottomBar>
  )
}

export function BoardDrag({ children }: { children: ReactNode }) {
  const { t } = useTranslation('planner')
  const accessibility = useMemo(
    () => ({
      announcements: dragAnnouncements(t, placeOnBoard(t)),
      screenReaderInstructions: { draggable: t('dragInstructions') }
    }),
    [t]
  )
  const sensors = useCellSensors()
  const ghost = useDragGhost()
  const { lift, follow, glide, land } = ghost
  const [active, setActive] = useState<string | null>(null)
  const latest = useRef<Latest>({
    active: null,
    hover: null,
    point: null,
    inserting: false,
    dwelling: null
  })
  const dwell = useRef<{ cell: string | null; timer?: ReturnType<typeof setTimeout> }>({
    cell: null
  })
  const boxes = useRef<(id: string) => DOMRect | undefined>(() => undefined)

  const aim = useCallback(function aim() {
    const { active, hover, point, inserting, dwelling } = latest.current
    if (!active) return
    const { board } = plannerStore.getState()
    const boxOf = boxes.current
    const target = dropTarget({ board, active, hover, point, inserting, dwelling, boxOf })
    dragStore.setState({ target })

    const over = target && target.kind !== 'insert' ? target.id : null
    if (over === dwell.current.cell) return
    clearTimeout(dwell.current.timer)
    latest.current.dwelling = null
    dragStore.setState({ albumFull: false })
    dwell.current = { cell: over }
    if (!over) return
    dwell.current.timer = setTimeout(() => {
      if (groupProblem(plannerStore.getState().board, [over, active]) === 'tooMany') {
        dragStore.setState({ albumFull: true })
        return
      }
      latest.current.dwelling = over
      aim()
    }, GROUP_DWELL_MS)
  }, [])

  const collide = useCallback<CollisionDetection>((args) => {
    const { collisionRect, droppableContainers, pointerCoordinates } = args
    const find = (id: unknown) => droppableContainers.find((droppable) => droppable.id === id)
    boxes.current = (id) => find(id)?.node.current?.getBoundingClientRect()
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
    const mouse = (event: MouseEvent) => follow(pointOf(event))
    const touch = ({ touches: [finger] }: TouchEvent) => follow(pointOf(finger))
    document.documentElement.toggleAttribute('data-dragging', true)
    window.addEventListener('keydown', shift)
    window.addEventListener('keyup', shift)
    window.addEventListener('mousemove', mouse)
    window.addEventListener('touchmove', touch)
    return () => {
      document.documentElement.toggleAttribute('data-dragging', false)
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
    latest.current.dwelling = null
    clearTimeout(dwell.current.timer)
    dwell.current = { cell: null }
    dragStore.setState({ dragging: false, target: null, albumFull: false })
    setActive(null)
    if (!id) return
    launch([id])
    const landing = apply && target ? place(id, target) : id
    const merging = apply && target?.kind === 'group'
    requestAnimationFrame(() => land(cellBox(landing), () => ground([id]), { merging }))
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
      <AnimatePresence>{active && <DragHint key="hint" />}</AnimatePresence>
    </DndContext>
  )
}
