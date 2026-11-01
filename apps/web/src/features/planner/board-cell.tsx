import { ArrowRightLeft, Trash2 } from 'lucide-react'
import { m, useMotionValue } from 'motion/react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { Container } from './board'
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

export function BoardCell({ id, container, position }: BoardCellProps) {
  const { t } = useTranslation('planner')
  const cell = useRef<HTMLDivElement>(null)
  const near = useNearViewport(cell)
  const { ref: dragRef, listeners, isDragging, dropArea } = useCellDrag(id, container)
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
  const toTray = container === 'grid'

  return (
    <m.div
      ref={ref}
      {...listeners}
      {...dropArea}
      data-mark={mark}
      layout={!airborne}
      layoutDependency={`${container}:${position}`}
      transition={{ layout: settle }}
      onLayoutAnimationStart={() => zIndex.set(GLIDING_Z)}
      onLayoutAnimationComplete={() => zIndex.set(0)}
      className={cn(
        'group relative cursor-grab overflow-hidden bg-muted select-none active:cursor-grabbing',
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
      {(mark === 'before' || mark === 'after') && (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 w-1 bg-primary',
            mark === 'before' ? 'left-0' : 'right-0'
          )}
        />
      )}
      {!mark && (
        <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t(toTray ? 'moveToTray' : 'moveToGrid')}
            onClick={() => plannerStore.getState().move(id, toTray ? 'tray' : 'grid')}
          >
            <ArrowRightLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t('remove')}
            onClick={() => plannerStore.getState().remove([id])}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </m.div>
  )
}
