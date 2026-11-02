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
import { memo, useCallback, useRef } from 'react'
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
  locked
}: Pick<BoardCellProps, 'id' | 'container'> & { locked: boolean }) {
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
        label={t('openImage')}
        onClick={() => openLightbox(coverOf(plannerStore.getState().board, id))}
      >
        <Maximize2 />
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

/** Always in view, unlike the actions: it says what the cell is, and opens what it says. */
const AlbumButton = memo(function AlbumButton({ id, size }: { id: string; size: number }) {
  const { t } = useTranslation('planner')
  return (
    <>
      <IconButton
        variant="outline"
        size="xs"
        tabIndex={-1}
        tooltip={cellTooltip}
        label={t('openAlbum')}
        className="pointer-events-auto gap-0.5 px-1 tabular-nums"
        onClick={() => openAlbum(id)}
      >
        <Layers />
        {size}
      </IconButton>
      <span className="sr-only">{t('albumOf', { count: size })}</span>
    </>
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
      variant="ghost"
      size="icon-xs"
      tabIndex={-1}
      tooltip={cellTooltip}
      label={t(selected ? 'deselect' : 'select')}
      aria-pressed={selected}
      className={cn(
        'absolute right-1 bottom-1 rounded-full border-2 opacity-0 transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out group-hover:opacity-100 focus-visible:opacity-100 active:scale-90 pointer-coarse:opacity-100',
        selected
          ? 'border-primary bg-primary text-primary-foreground opacity-100 hover:border-primary/90 hover:bg-primary/90'
          : 'border-on-photo bg-photo-scrim text-transparent shadow-xs hover:bg-photo-scrim hover:text-on-photo'
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
}

function CellBadge({ icon: Icon, label }: CellBadgeProps) {
  return (
    <span className="flex items-center gap-0.5 rounded-sm bg-background p-1 text-xs/3 text-foreground shadow-xs">
      <Icon aria-hidden className="size-3" />
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
      onDoubleClick={(event) => {
        if (!(event.target as HTMLElement).closest('button')) openLightbox(cover)
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
          (mark === 'swap' || mark === 'group' || isDragging) && 'opacity-100'
        )}
      />
      {mark === 'group' && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <m.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={settle}
            className="rounded-md bg-primary p-1.5 text-primary-foreground shadow-md"
          >
            <Layers aria-hidden className="size-5" />
          </m.span>
        </span>
      )}
      <div className="pointer-events-none absolute bottom-1 left-1 flex gap-1">
        {albumSize && <AlbumButton id={id} size={albumSize} />}
        {locked && <CellBadge icon={Lock} />}
        {missing && <CellBadge icon={ImageOff} label={t('missingOriginal')} />}
      </div>
      {!mark && <SelectToggle id={id} selected={selected} />}
      {!mark && <CellActions id={id} container={container} locked={locked} />}
    </m.div>
  )
})
