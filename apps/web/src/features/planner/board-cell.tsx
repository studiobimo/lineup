import { ArrowRightLeft, Trash2 } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { useDropMark } from './drag-target'
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
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      cell.current = node
      dragRef(node)
    },
    [dragRef]
  )
  const toTray = container === 'grid'

  return (
    <div
      ref={ref}
      {...listeners}
      {...dropArea}
      data-mark={mark}
      className={cn(
        'group relative cursor-grab overflow-hidden bg-muted select-none active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {near && <Thumbnail id={id} label={t('cell', { position })} />}
      {mark === 'swap' && (
        <div className="pointer-events-none absolute inset-0 ring-3 ring-primary ring-inset" />
      )}
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
    </div>
  )
}
