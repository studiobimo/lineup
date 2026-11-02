import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { BoardCell } from './board-cell'
import { cellShape, gridColumns } from './network-profile'
import { usePlanner } from './planner'
import { useTabStop } from './tab-stop'

const SKELETON_CELLS = 6

export function Cells({ container, className }: { container: Container; className?: string }) {
  const { t } = useTranslation('planner')
  const ids = usePlanner((state) => state.board[container])
  const ready = usePlanner((state) => state.ready)
  const focused = useTabStop(container)
  if (!ready) {
    return (
      <div
        role="status"
        aria-label={t('loading')}
        className={cn('grid gap-0.5', className)}
        style={gridColumns}
      >
        {Array.from({ length: SKELETON_CELLS }, (_, cell) => (
          <Skeleton key={cell} style={cellShape} />
        ))}
      </div>
    )
  }
  if (ids.length === 0) {
    return (
      <p className="p-gutter text-sm text-muted-foreground">
        {t(container === 'tray' ? 'trayEmpty' : 'gridEmpty')}
      </p>
    )
  }
  const tabStop = focused && ids.includes(focused) ? focused : ids[0]
  return (
    <div className={cn('grid gap-0.5', className)} style={gridColumns}>
      {ids.map((id, index) => (
        <BoardCell
          key={id}
          id={id}
          container={container}
          position={index + 1}
          tabStop={id === tabStop}
        />
      ))}
    </div>
  )
}
