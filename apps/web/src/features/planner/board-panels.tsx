import { Redo2, Undo2 } from 'lucide-react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { AreaBoundary } from '@/components/area-boundary'
import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { Group } from '@/components/ui/group'
import { Intro } from '@/features/help/intro'
import { cn } from '@/lib/utils'

import { ClearBoard, ContainerActions, PreviewOnPhone } from './board-actions'
import { Cells } from './board-cells'
import { useEmptyAreaMark } from './drag-target'
import { ImportButtons, ImportProgress } from './import-controls'
import { plannerStore, usePlanner } from './planner'
import { useDropArea } from './use-board-drag'

function History() {
  const { t } = useTranslation('planner')
  const canUndo = usePlanner((state) => state.past.length > 0)
  const canRedo = usePlanner((state) => state.future.length > 0)
  return (
    <Group aria-label={t('history')}>
      <IconButton
        variant="outline"
        label={t('undo')}
        disabled={!canUndo}
        onClick={() => plannerStore.getState().undo()}
      >
        <Undo2 />
      </IconButton>
      <IconButton
        variant="outline"
        label={t('redo')}
        disabled={!canRedo}
        onClick={() => plannerStore.getState().redo()}
      >
        <Redo2 />
      </IconButton>
    </Group>
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

function TrayToolbar() {
  return (
    <div className="flex flex-wrap gap-2 px-gutter pb-gutter">
      <ImportButtons />
      <ContainerActions container="tray" />
    </div>
  )
}

export function TrayPanel() {
  const { t } = useTranslation('planner')
  const { ref, dropArea } = useDropArea('tray')
  const marked = useEmptyAreaMark('tray')
  return (
    <m.aside
      ref={ref}
      {...dropArea}
      layoutScroll
      data-scroll-root
      className={cn(
        'sticky top-14 h-[calc(100dvh-3.5rem)] w-80 shrink-0 overflow-y-auto border-r',
        marked && 'ring-3 ring-primary ring-inset'
      )}
    >
      <h2 className="p-gutter text-xl">{t('tray')}</h2>
      <TrayToolbar />
      <ImportProgress />
      <AreaBoundary>
        <Cells container="tray" className="px-gutter pb-gutter" />
      </AreaBoundary>
    </m.aside>
  )
}

export function GridPanel({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation('planner')
  const { ref, dropArea } = useDropArea('grid')
  const marked = useEmptyAreaMark('grid')
  return (
    <section
      ref={ref}
      {...dropArea}
      className={cn('min-w-0 flex-1', marked && 'ring-3 ring-primary ring-inset')}
    >
      <div className="mx-auto max-w-3xl">
        <Intro />
        <div className="flex items-center justify-between gap-2 p-gutter">
          <h2 className="text-xl">{t('grid')}</h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!desktop && <MobileTray />}
            <ContainerActions container="grid">
              <ClearBoard />
              <PreviewOnPhone />
            </ContainerActions>
            <History />
          </div>
        </div>
        {!desktop && <TrayToolbar />}
        {!desktop && <ImportProgress />}
        {/* On a phone the grid runs edge to edge, as it does in Instagram. */}
        <AreaBoundary>
          <Cells container="grid" className={cn(desktop && 'px-gutter pb-gutter')} />
        </AreaBoundary>
      </div>
    </section>
  )
}
