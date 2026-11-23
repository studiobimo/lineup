import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { BoardCell } from './board-cell'
import { cellShape, gridColumns } from './network-profile'
import { usePlanner } from './planner'
import { useTabStop } from './tab-stop'

const SKELETON_CELLS = 6

interface CellsProps {
  container: Container
  className?: string
  after?: ReactNode
}

export function Cells({ container, className, after }: CellsProps) {
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
  const tabStop = focused && ids.includes(focused) ? focused : ids[0]
  return (
    <>
      <div className={cn('peer grid gap-0.5 empty:hidden', className)} style={gridColumns}>
        {ids.map((id, index) => (
          <BoardCell
            key={id}
            id={id}
            container={container}
            position={index + 1}
            tabStop={id === tabStop}
          />
        ))}
        {after}
      </div>
      {ids.length === 0 && (
        <Empty className="peer-not-empty:hidden">
          <EmptyHeader>
            <EmptyTitle>{t(container)}</EmptyTitle>
            <EmptyDescription>
              {t(container === 'tray' ? 'trayEmpty' : 'gridEmpty')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  )
}
