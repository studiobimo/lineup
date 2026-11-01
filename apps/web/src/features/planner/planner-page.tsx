import { Redo2, Undo2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { ToastProvider } from '@/components/ui/toast'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { BoardCell } from './board-cell'
import { type BoardHold, holdBoard } from './board-lock'
import { ImportButtons, ImportProgress, ImportTargets } from './import-controls'
import { instagram } from './network-profile'
import { plannerStore, usePlanner } from './planner'

const columns = { gridTemplateColumns: `repeat(${instagram.columns}, minmax(0, 1fr))` }

function Cells({ container, className }: { container: Container; className?: string }) {
  const { t } = useTranslation('planner')
  const ids = usePlanner((state) => state.board[container])
  if (ids.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t(container === 'tray' ? 'trayEmpty' : 'gridEmpty')}
      </p>
    )
  }
  return (
    <div className={cn('grid gap-0.5', className)} style={columns}>
      {ids.map((id, index) => (
        <BoardCell key={id} id={id} container={container} position={index + 1} />
      ))}
    </div>
  )
}

function History() {
  const { t } = useTranslation('planner')
  const canUndo = usePlanner((state) => state.past.length > 0)
  const canRedo = usePlanner((state) => state.future.length > 0)
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('undo')}
        disabled={!canUndo}
        onClick={() => plannerStore.getState().undo()}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('redo')}
        disabled={!canRedo}
        onClick={() => plannerStore.getState().redo()}
      >
        <Redo2 />
      </Button>
    </div>
  )
}

function MobileTray() {
  const { t } = useTranslation('planner')
  const count = usePlanner((state) => state.board.tray.length)
  return (
    <Drawer>
      <DrawerTrigger render={<Button variant="outline" size="sm" />}>
        {t('trayCount', { count })}
      </DrawerTrigger>
      <DrawerPopup>
        <DrawerHeader>
          <DrawerTitle>{t('tray')}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel>
          <Cells container="tray" />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

export function PlannerPage() {
  const { t } = useTranslation('planner')
  const desktop = useMediaQuery('md')
  const ready = usePlanner((state) => state.ready)
  const session = usePlanner((state) => state.session)
  const hold = useRef<BoardHold>(null)

  useEffect(() => {
    const { load, suspend } = plannerStore.getState()
    const current = holdBoard({ onActive: () => void load(), onElsewhere: suspend })
    hold.current = current
    return () => {
      current.release()
      plannerStore.setState({ session: 'starting' })
    }
  }, [])

  if (session === 'elsewhere') {
    return (
      <Empty className="min-h-[calc(100dvh-3.5rem)]">
        <EmptyHeader>
          <EmptyTitle>
            <h1>{t('elsewhereTitle')}</h1>
          </EmptyTitle>
          <EmptyDescription>{t('elsewhereDescription')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => hold.current?.takeOver()}>{t('useHere')}</Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ToastProvider>
      <div className={cn('flex', !desktop && 'flex-col')}>
        <h1 className="sr-only">{t('title')}</h1>
        <ImportTargets />
        {desktop && (
          <aside
            data-scroll-root
            className="sticky top-14 h-[calc(100dvh-3.5rem)] w-80 shrink-0 overflow-y-auto border-r"
          >
            <h2 className="p-4 text-xl">{t('tray')}</h2>
            <ImportButtons />
            <ImportProgress />
            <Cells container="tray" className="px-4 pb-4" />
          </aside>
        )}
        <section className="min-w-0 flex-1">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between gap-2 p-4">
              <h2 className="text-xl">{t('grid')}</h2>
              <div className="flex items-center gap-2">
                {!desktop && <MobileTray />}
                <History />
              </div>
            </div>
            {!desktop && <ImportButtons />}
            {!desktop && <ImportProgress />}
            {/* On a phone the grid runs edge to edge, as it does in Instagram. */}
            {ready && <Cells container="grid" className={cn(desktop && 'px-4 pb-4')} />}
          </div>
        </section>
      </div>
    </ToastProvider>
  )
}
