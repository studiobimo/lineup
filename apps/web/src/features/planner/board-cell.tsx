import { ImageOff, Layers, Lock, Play } from 'lucide-react'
import { m, useMotionValue } from 'motion/react'
import { memo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { durationText } from '@/i18n/format'
import { onButton } from '@/lib/dom'
import { cn } from '@/lib/utils'

import { type Container, coverOf, isLocked } from './board'
import type { CellPost } from './board-schema'
import { AlbumButton, CellActions, CellBadge, SelectToggle } from './cell-controls'
import { useAirborne, useDropMark } from './drag-target'
import { openLightbox } from './lightbox-store'
import { GLIDING_Z, settle } from './motion'
import { cellShape } from './network-profile'
import { usePlanner } from './planner'
import { PostBadge } from './post-badge'
import { clickCell, useIsSelected } from './selection-store'
import { setTabStop } from './tab-stop'
import { CellThumbnail } from './thumbnail'
import { useCellDrag } from './use-board-drag'
import { useNearViewport } from './use-near-viewport'

interface BoardCellProps {
  id: string
  container: Container
  position: number
  tabStop: boolean
}

function useCellState(id: string) {
  const locked = usePlanner(({ board }) => isLocked(board, id))
  const cover = usePlanner(({ board }) => coverOf(board, id))
  const albumSize = usePlanner(({ board }) => board.albums?.[id]?.length)
  const post = usePlanner(({ board }) => board.posts?.[id])
  const missing = usePlanner(({ images }) => images[cover]?.missing)
  const duration = usePlanner(({ images }) => images[cover]?.video?.duration)
  return { locked, cover, albumSize, post, missing, duration }
}

function GroupMark() {
  return (
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
  )
}

function CellBadges({
  id,
  albumSize,
  post,
  duration,
  locked,
  missing
}: {
  id: string
  albumSize?: number
  post?: CellPost
  duration?: number
  locked: boolean
  missing?: boolean
}) {
  const { t } = useTranslation('planner')
  return (
    <div className="pointer-events-none absolute bottom-1 left-1 flex flex-wrap gap-1">
      {albumSize && <AlbumButton id={id} size={albumSize} />}
      {post && <PostBadge id={id} post={post} />}
      {duration !== undefined && (
        <CellBadge
          icon={Play}
          text={durationText(duration)}
          label={t('videoLength', { length: durationText(duration) })}
        />
      )}
      {locked && !post && <CellBadge icon={Lock} />}
      {missing && <CellBadge icon={ImageOff} label={t('missingOriginal')} />}
    </div>
  )
}

function CellPicture({
  id,
  position,
  near,
  missing,
  mark,
  dragging
}: {
  id: string
  position: number
  near: boolean
  missing?: boolean
  mark: ReturnType<typeof useDropMark>
  dragging: boolean
}) {
  const { t } = useTranslation('planner')
  return (
    <>
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
          (mark === 'swap' || mark === 'group' || dragging) && 'opacity-100'
        )}
      />{' '}
    </>
  )
}

function useCellDragRef(id: string, container: Container, locked: boolean) {
  const { t } = useTranslation('planner')
  const cell = useRef<HTMLDivElement>(null)
  const { ref: dragRef, ...drag } = useCellDrag({
    id,
    container,
    locked,
    roleDescription: t(locked ? 'cellRoleLocked' : 'cellRole')
  })
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      cell.current = node
      dragRef(node)
    },
    [dragRef]
  )
  return { cell, ref, ...drag }
}

export const BoardCell = memo(function BoardCell({
  id,
  container,
  position,
  tabStop
}: BoardCellProps) {
  const { t } = useTranslation('planner')
  const { locked, cover, albumSize, post, missing, duration } = useCellState(id)
  const video = duration !== undefined
  const selected = useIsSelected(id)
  const { cell, ref, attributes, listeners, isDragging, dropArea } = useCellDragRef(
    id,
    container,
    locked
  )
  const near = useNearViewport(cell)
  const mark = useDropMark(id)
  const airborne = useAirborne(id)
  const zIndex = useMotionValue(0)

  return (
    <m.div
      ref={ref}
      {...attributes}
      {...listeners}
      aria-disabled={undefined}
      tabIndex={tabStop ? 0 : -1}
      onFocus={() => setTabStop(container, id)}
      onClick={(event) => {
        if (!onButton(event.target)) clickCell(id, event)
      }}
      onDoubleClick={(event) => {
        if (!onButton(event.target)) openLightbox(cover)
      }}
      aria-label={t(video && !albumSize ? 'videoCell' : 'cell', { position })}
      {...dropArea}
      data-mark={mark}
      layout={!airborne}
      layoutDependency={`${container}:${position}`}
      transition={{ layout: settle }}
      onLayoutAnimationStart={() => zIndex.set(GLIDING_Z)}
      onLayoutAnimationComplete={() => zIndex.set(0)}
      className={cn(
        'group relative cursor-pointer touch-manipulation overflow-hidden bg-muted select-none [-webkit-touch-callout:none] focus-visible:photo-outline',
        selected && 'photo-outline',
        isDragging && 'opacity-30',
        airborne && 'opacity-0'
      )}
      style={{ ...cellShape, zIndex }}
    >
      <CellPicture
        id={id}
        position={position}
        near={near}
        missing={missing}
        mark={mark}
        dragging={isDragging}
      />
      {mark === 'group' && <GroupMark />}
      <CellBadges
        id={id}
        albumSize={albumSize}
        post={post}
        duration={duration}
        locked={locked}
        missing={missing}
      />
      {!mark && (
        <>
          <SelectToggle id={id} selected={selected} />
          <CellActions id={id} container={container} locked={locked} posted={post !== undefined} />
        </>
      )}
    </m.div>
  )
})
