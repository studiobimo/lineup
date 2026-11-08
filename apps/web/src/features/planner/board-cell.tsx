import { ImageOff, Layers, Lock, Play } from 'lucide-react'
import { m, useMotionValue } from 'motion/react'
import { memo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { durationText } from '@/i18n/format'
import { onButton } from '@/lib/dom'
import { cn } from '@/lib/utils'

import { type Container, coverOf, isLocked } from './board'
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
  /** Whether Tab lands here. A container is one stop however many cells it has. */
  tabStop: boolean
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
  const post = usePlanner(({ board }) => board.posts?.[id])
  const missing = usePlanner(({ images }) => images[cover]?.missing)
  const duration = usePlanner(({ images }) => images[cover]?.video?.duration)
  const video = duration !== undefined
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
      <div className="pointer-events-none absolute bottom-1 left-1 flex flex-wrap gap-1">
        {albumSize && <AlbumButton id={id} size={albumSize} />}
        {post && <PostBadge id={id} post={post} />}
        {video && (
          <CellBadge
            icon={Play}
            text={durationText(duration)}
            label={t('videoLength', { length: durationText(duration) })}
          />
        )}
        {locked && !post && <CellBadge icon={Lock} />}
        {missing && <CellBadge icon={ImageOff} label={t('missingOriginal')} />}
      </div>
      {!mark && <SelectToggle id={id} selected={selected} />}
      {!mark && (
        <CellActions id={id} container={container} locked={locked} posted={post !== undefined} />
      )}
    </m.div>
  )
})
