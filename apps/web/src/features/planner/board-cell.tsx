import {
  ArrowRightLeft,
  Check,
  ImageOff,
  Layers,
  Lock,
  LockOpen,
  type LucideIcon,
  Maximize2,
  Trash2
} from 'lucide-react'
import { m, useMotionValue } from 'motion/react'
import { memo, type ReactNode, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/utils'
import { openAlbum } from '@/features/albums/album-store'

import { type Container, coverOf, isLocked } from './board'
import { cellTooltip } from './cell-tooltip'
import { useAirborne, useDropMark } from './drag-target'
import { openLightbox } from './lightbox-store'
import { GLIDING_Z, settle } from './motion'
import { cellShape } from './network-profile'
import { plannerStore, usePlanner } from './planner'
import { clickCell, toggleSelected, useIsSelected } from './selection-store'
import { setTabStop } from './tab-stop'
import { CellThumbnail } from './thumbnail'
import { useCellDrag } from './use-board-drag'
import { useNearViewport } from './use-near-viewport'

interface BoardCellProps {
  id: string
  container: Container
  position: number
  /** Whether Tab lands here. A container is one stop however many cells it has. */
  tabStop: boolean
}

/**
 * Memoised, because every cell renders when one moves and these do not depend on position. For the
 * mouse: the keyboard has Enter on the cell, or these would be three more tab stops per image.
 */
const CellActions = memo(function CellActions({
  id,
  container,
  locked,
  album
}: Pick<BoardCellProps, 'id' | 'container'> & { locked: boolean; album: boolean }) {
  const { t } = useTranslation('planner')
  const toTray = container === 'grid'
  const LockToggle = locked ? LockOpen : Lock
  return (
    <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
      <IconButton
        variant="outline"
        size="icon-xs"
        tabIndex={-1}
        tooltip={cellTooltip}
        label={t(album ? 'openAlbum' : 'openImage')}
        onClick={() => (album ? openAlbum(id) : openLightbox(id))}
      >
        {album ? <Layers /> : <Maximize2 />}
      </IconButton>
      {toTray && (
        <IconButton
          variant="outline"
          size="icon-xs"
          tabIndex={-1}
          tooltip={cellTooltip}
          label={t(locked ? 'unlock' : 'lock')}
          onClick={() => plannerStore.getState().toggleLock(id)}
        >
          <LockToggle />
        </IconButton>
      )}
      {!locked && (
        <>
          <IconButton
            variant="outline"
            size="icon-xs"
            tabIndex={-1}
            tooltip={cellTooltip}
            label={t(toTray ? 'moveToTray' : 'moveToGrid')}
            onClick={() => plannerStore.getState().move(id, toTray ? 'tray' : 'grid')}
          >
            <ArrowRightLeft />
          </IconButton>
          <IconButton
            variant="outline"
            size="icon-xs"
            tabIndex={-1}
            tooltip={cellTooltip}
            label={t('remove')}
            onClick={() => plannerStore.getState().remove([id])}
          >
            <Trash2 />
          </IconButton>
        </>
      )}
    </div>
  )
})

/** In its own corner, because a narrow cell's actions already fill its top edge. */
const SelectToggle = memo(function SelectToggle({
  id,
  selected
}: {
  id: string
  selected: boolean
}) {
  const { t } = useTranslation('planner')
  return (
    <IconButton
      variant={selected ? 'default' : 'outline'}
      size="icon-xs"
      tabIndex={-1}
      tooltip={cellTooltip}
      label={t(selected ? 'deselect' : 'select')}
      aria-pressed={selected}
      className={cn(
        'absolute right-1 bottom-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
        selected && 'opacity-100'
      )}
      onClick={() => toggleSelected(id)}
    >
      <Check />
    </IconButton>
  )
})

interface CellBadgeProps {
  icon: LucideIcon
  label?: string
  children?: ReactNode
}

function CellBadge({ icon: Icon, label, children }: CellBadgeProps) {
  return (
    <span className="flex items-center gap-0.5 rounded-sm bg-background p-1 text-xs/3 text-foreground shadow-xs">
      <Icon aria-hidden className="size-3" />
      {children}
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

/** Memoised, so that moving focus renders the two cells it touches and not all 300. */
export const BoardCell = memo(function BoardCell({
  id,
  container,
  position,
  tabStop
}: BoardCellProps) {
  const { t } = useTranslation('planner')
  const cell = useRef<HTMLDivElement>(null)
  const near = useNearViewport(cell)
  const locked = usePlanner(({ board }) => isLocked(board, id))
  const cover = usePlanner(({ board }) => coverOf(board, id))
  const albumSize = usePlanner(({ board }) => board.albums?.[id]?.length)
  const missing = usePlanner(({ images }) => images[cover]?.missing)
  const selected = useIsSelected(id)
  const {
    ref: dragRef,
    attributes,
    listeners,
    isDragging,
    dropArea
  } = useCellDrag({
    id,
    container,
    locked,
    roleDescription: t(locked ? 'cellRoleLocked' : 'cellRole')
  })
  const mark = useDropMark(id)
  const airborne = useAirborne(id)
  const zIndex = useMotionValue(0)
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      cell.current = node
      dragRef(node)
    },
    [dragRef]
  )

  return (
    <m.div
      ref={ref}
      {...attributes}
      {...listeners}
      // Not the library's disabled: a locked cell's own buttons still work.
      aria-disabled={undefined}
      tabIndex={tabStop ? 0 : -1}
      onFocus={() => setTabStop(container, id)}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button')) clickCell(id, event)
      }}
      aria-label={t('cell', { position })}
      {...dropArea}
      data-mark={mark}
      layout={!airborne}
      layoutDependency={`${container}:${position}`}
      transition={{ layout: settle }}
      onLayoutAnimationStart={() => zIndex.set(GLIDING_Z)}
      onLayoutAnimationComplete={() => zIndex.set(0)}
      className={cn(
        'group relative touch-manipulation overflow-hidden bg-muted select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        !locked && 'cursor-grab active:cursor-grabbing',
        selected && 'outline-2 -outline-offset-2 outline-primary',
        isDragging && 'opacity-30',
        airborne && 'opacity-0'
      )}
      style={{ ...cellShape, zIndex }}
    >
      <div
        onDoubleClick={() => openLightbox(cover)}
        className={cn(
          'size-full transition duration-200 ease-out',
          missing && 'opacity-50 grayscale',
          mark === 'swap' && 'scale-95 opacity-50',
          mark === 'group' && 'scale-90'
        )}
      >
        {near && <CellThumbnail id={id} label={t('cell', { position })} />}
      </div>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-linear-to-b from-foreground/25 to-foreground/5 opacity-0 transition-opacity duration-200 ease-out',
          (mark === 'swap' || isDragging) && 'opacity-100'
        )}
      />
      {mark === 'group' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-md bg-primary p-1.5 text-primary-foreground shadow-md">
            <Layers aria-hidden className="size-5" />
          </span>
        </span>
      )}
      <div className="pointer-events-none absolute bottom-1 left-1 flex gap-1">
        {albumSize && (
          <CellBadge icon={Layers} label={t('albumOf', { count: albumSize })}>
            <span aria-hidden>{albumSize}</span>
          </CellBadge>
        )}
        {locked && <CellBadge icon={Lock} />}
        {missing && <CellBadge icon={ImageOff} label={t('missingOriginal')} />}
      </div>
      {!mark && <SelectToggle id={id} selected={selected} />}
      {!mark && (
        <CellActions
          id={id}
          container={container}
          locked={locked}
          album={albumSize !== undefined}
        />
      )}
    </m.div>
  )
})
