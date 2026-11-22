import {
  ArrowRightLeft,
  CalendarClock,
  Check,
  Lock,
  LockOpen,
  type LucideIcon,
  Maximize2,
  Trash2
} from 'lucide-react'

import { openPost } from '@/features/provider/post-store'

import { type Container, containerOf, coverOf, isLocked } from './board'
import type { Board } from './board-store'
import { openLightbox } from './lightbox-store'
import { plannerStore } from './planner'
import { selectedCells, toggleSelected } from './selection-store'

export interface ActionContext {
  scope: 'cell' | 'selection'
  ids: string[]
  inTray: boolean
  inGrid: boolean
  locked: boolean
  posted: boolean
  selected: boolean
  canSchedule: boolean
}

export interface BoardAction {
  label: (context: ActionContext) => string
  icon: (context: ActionContext) => LucideIcon
  enabled: (context: ActionContext) => boolean
  run: (context: ActionContext) => void
  leavesCell?: boolean
}

interface CellFacts {
  id: string
  container: Container
  locked: boolean
  posted: boolean
  canSchedule: boolean
  selected?: boolean
}

export const selectLabel = (selected: boolean) => (selected ? 'deselect' : 'select')

export const cellContext = ({
  id,
  container,
  locked,
  posted,
  canSchedule,
  selected = false
}: CellFacts): ActionContext => ({
  scope: 'cell',
  ids: [id],
  inTray: container === 'tray',
  inGrid: container === 'grid',
  locked,
  posted,
  selected,
  canSchedule
})

export const boardCellContext = (board: Board, id: string, canSchedule: boolean) =>
  cellContext({
    id,
    container: containerOf(board, id),
    locked: isLocked(board, id),
    posted: board.posts?.[id] !== undefined,
    selected: selectedCells().includes(id),
    canSchedule
  })

export const selectionContext = (board: Board, ids: string[]): ActionContext => ({
  scope: 'selection',
  ids,
  inTray: ids.some((id) => containerOf(board, id) === 'tray'),
  inGrid: ids.some((id) => containerOf(board, id) === 'grid'),
  locked: false,
  posted: false,
  selected: false,
  canSchedule: false
})

const forCell = (context: ActionContext) => context.scope === 'cell'
const editable = (context: ActionContext) => context.scope === 'selection' || !context.locked
const firstId = (context: ActionContext) => context.ids[0]

const moveTo = (to: Container, context: ActionContext) => {
  const { moveToStart, moveCells } = plannerStore.getState()
  if (forCell(context)) moveToStart(context.ids, to)
  else moveCells(context.ids, to)
}

const boardActions = {
  openImage: {
    label: () => 'openImage',
    icon: () => Maximize2,
    enabled: forCell,
    run: (context) => openLightbox(coverOf(plannerStore.getState().board, firstId(context)))
  },
  select: {
    label: ({ selected }) => selectLabel(selected),
    icon: () => Check,
    enabled: forCell,
    run: (context) => toggleSelected(firstId(context))
  },
  postDetails: {
    label: () => 'postDetails',
    icon: () => CalendarClock,
    enabled: (context) => forCell(context) && context.posted,
    run: (context) => openPost(firstId(context))
  },
  schedule: {
    label: () => 'schedule',
    icon: () => CalendarClock,
    enabled: (context) =>
      forCell(context) && context.inGrid && context.canSchedule && !context.posted,
    run: (context) => openPost(firstId(context))
  },
  lock: {
    label: ({ locked }) => (locked ? 'unlock' : 'lock'),
    icon: ({ locked }) => (locked ? LockOpen : Lock),
    enabled: (context) => forCell(context) && context.inGrid && !context.posted,
    run: (context) => plannerStore.getState().toggleLock(firstId(context))
  },
  moveToGrid: {
    label: () => 'moveToGrid',
    icon: () => ArrowRightLeft,
    enabled: (context) => context.inTray && editable(context),
    run: (context) => moveTo('grid', context),
    leavesCell: true
  },
  moveToTray: {
    label: () => 'moveToTray',
    icon: () => ArrowRightLeft,
    enabled: (context) => context.inGrid && editable(context),
    run: (context) => moveTo('tray', context),
    leavesCell: true
  },
  remove: {
    label: () => 'remove',
    icon: () => Trash2,
    enabled: editable,
    run: (context) => plannerStore.getState().remove(context.ids),
    leavesCell: true
  }
} satisfies Record<string, BoardAction>

type BoardActionKey = keyof typeof boardActions

const actionSurfaces = {
  menuOpen: ['openImage'],
  menuPost: ['select', 'postDetails', 'schedule', 'lock'],
  menuEdit: ['moveToGrid', 'moveToTray', 'remove'],
  controls: ['openImage', 'schedule', 'lock', 'moveToGrid', 'moveToTray', 'remove'],
  selectionMove: ['moveToGrid', 'moveToTray'],
  selectionRemove: ['remove']
} as const satisfies Record<string, readonly BoardActionKey[]>

export type ActionSurface = keyof typeof actionSurfaces

export const visibleActions = (surface: ActionSurface, context: ActionContext) =>
  actionSurfaces[surface]
    .map((key) => ({ key, action: boardActions[key] as BoardAction }))
    .filter(({ action }) => action.enabled(context))
