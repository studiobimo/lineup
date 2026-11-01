import { ArrowRightLeft, Trash2 } from 'lucide-react'
import { m, useMotionValue } from 'motion/react'
import { memo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { cellTooltip } from './cell-tooltip'
import { useAirborne, useDropMark } from './drag-target'
import { GLIDING_Z, settle } from './motion'
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { Thumbnail } from './thumbnail'
import { useCellDrag } from './use-board-drag'
import { useNearViewport } from './use-near-viewport'

const { width, height } = instagram.cellRatio

interface BoardCellProps {
  id: string
  container: Container
  position: number
}

/** Memoised, because every cell renders when one moves and these do not depend on position. */
const CellActions = memo(function CellActions({ id, container }: Omit<BoardCellProps, 'position'>) {
  const { t } = useTranslation('planner')
  const toTray = container === 'grid'
  return (
    <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
      <IconButton
        variant="outline"
        size="icon-xs"
        tooltip={cellTooltip}
        label={t(toTray ? 'moveToTray' : 'moveToGrid')}
        onClick={() => plannerStore.getState().move(id, toTray ? 'tray' : 'grid')}
      >
        <ArrowRightLeft />
      </IconButton>
      <IconButton
        variant="outline"
        size="icon-xs"
        tooltip={cellTooltip}
        label={t('remove')}
        onClick={() => plannerStore.getState().remove([id])}
      >
        <Trash2 />
      </IconButton>
    </div>
  )
})

export function BoardCell({ id, container, position }: BoardCellProps) {
  const { t } = useTranslation('planner')
  const cell = useRef<HTMLDivElement>(null)
  const near = useNearViewport(cell)
  const {
    ref: dragRef,
    attributes,
    listeners,
    isDragging,
    dropArea
  } = useCellDrag(id, container, t('cellRole'))
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
      aria-label={t('cell', { position })}
      {...dropArea}
      data-mark={mark}
      layout={!airborne}
      layoutDependency={`${container}:${position}`}
      transition={{ layout: settle }}
      onLayoutAnimationStart={() => zIndex.set(GLIDING_Z)}
      onLayoutAnimationComplete={() => zIndex.set(0)}
      className={cn(
        'group relative cursor-grab touch-manipulation overflow-hidden bg-muted select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:cursor-grabbing',
        isDragging && 'opacity-30',
        airborne && 'opacity-0'
      )}
      style={{ aspectRatio: `${width} / ${height}`, zIndex }}
    >
      <div
        className={cn(
          'size-full transition duration-200 ease-out',
          mark === 'swap' && 'scale-95 opacity-50'
        )}
      >
        {near && <Thumbnail id={id} label={t('cell', { position })} />}
      </div>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-linear-to-b from-foreground/25 to-foreground/5 opacity-0 transition-opacity duration-200 ease-out',
          (mark === 'swap' || isDragging) && 'opacity-100'
        )}
      />
      {!mark && <CellActions id={id} container={container} />}
    </m.div>
  )
}
