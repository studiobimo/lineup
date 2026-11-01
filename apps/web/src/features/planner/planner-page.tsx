import { Redo2, Undo2 } from 'lucide-react'
import { useEffect } from 'react'
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
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { BoardCell } from './board-cell'
import { instagram } from './network-profile'
import { plannerStore, usePlanner } from './planner'

const columns = { gridTemplateColumns: `repeat(${instagram.columns}, minmax(0, 1fr))` }

function Cells({ container }: { container: Container }) {
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
    <div className="grid gap-0.5" style={columns}>
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

  useEffect(() => {
    void plannerStore.getState().load()
  }, [])

  return (
    <div className={cn('flex', !desktop && 'flex-col')}>
      <h1 className="sr-only">{t('title')}</h1>
      {desktop && (
        <aside
          data-scroll-root
          className="sticky top-14 h-[calc(100dvh-3.5rem)] w-80 shrink-0 overflow-y-auto border-r"
        >
          <h2 className="p-4 text-xl">{t('tray')}</h2>
          <Cells container="tray" />
        </aside>
      )}
      <section className="min-w-0 flex-1">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-2 p-4">
            <h2 className="text-xl">{t('grid')}</h2>
            <div className="flex items-center gap-2">
              {!desktop && <MobileTray />}
              <History />
            </div>
          </div>
          {ready && <Cells container="grid" />}
        </div>
      </section>
    </div>
  )
}
