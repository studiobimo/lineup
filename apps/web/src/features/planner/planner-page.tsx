import { Redo2, Undo2 } from 'lucide-react'
import { m } from 'motion/react'
import { Suspense, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { AreaBoundary } from '@/components/area-boundary'
import { IconButton, SharedTooltip } from '@/components/icon-button'
import { LazyOverlay } from '@/components/lazy-overlay'
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
import { Skeleton } from '@/components/ui/skeleton'
import { toastManager } from '@/components/ui/toast'
import { closeAlbum, useOpenAlbumId } from '@/features/albums/album-store'
import { Intro } from '@/features/help/intro'
import { useMediaQuery } from '@/hooks/use-media-query'
import { loadStrings } from '@/i18n/load-strings'
import { lazyComponent } from '@/lib/lazy-component'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { ClearBoard, ContainerActions, PreviewOnPhone } from './board-actions'
import { BoardCell } from './board-cell'
import { BoardDrag } from './board-drag'
import { BoardGate } from './board-gate'
import { type BoardHold, holdBoard } from './board-lock'
import { cellTooltip } from './cell-tooltip'
import { useEmptyAreaMark } from './drag-target'
import { ImportButtons, ImportProgress, ImportTargets } from './import-controls'
import { CellMenu } from './cell-menu'
import { closeLightbox, useLightboxId } from './lightbox-store'
import { cellShape, gridColumns } from './network-profile'
import { openBoard } from './open-board'
import { plannerStore, usePlanner } from './planner'
import { SelectionBar } from './selection-bar'
import { useDropArea } from './use-board-drag'
import { useTabStop } from './tab-stop'
import { usePlannerShortcuts } from './use-planner-shortcuts'

const SKELETON_CELLS = 6

const Lightbox = lazyComponent(() => import('./lightbox').then(({ Lightbox }) => Lightbox))
const AlbumDialog = lazyComponent(
  () => import('@/features/albums/album-dialog').then(({ AlbumDialog }) => AlbumDialog),
  () => loadStrings('albums')
)
const FolderGate = lazyComponent(
  () => import('./folder-gate').then(({ FolderGate }) => FolderGate),
  () => loadStrings('settings')
)

function Cells({ container, className }: { container: Container; className?: string }) {
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

// Often enough to catch a drive coming back, and rarely enough that nothing notices.
const RETRY_SAVE_MS = 5000

/** Stays up until a save goes through, because this is not something to miss. */
function SaveFailure() {
  const { t } = useTranslation('planner')
  const failed = usePlanner((state) => state.saveFailed)
  useEffect(() => {
    if (!failed) return
    const retry = setInterval(() => plannerStore.getState().retrySave(), RETRY_SAVE_MS)
    const id = toastManager.add({
      type: 'error',
      title: t('saveFailed'),
      description: t('saveFailedHelp'),
      timeout: 0
    })
    return () => {
      clearInterval(retry)
      toastManager.close(id)
    }
  }, [failed, t])
  return null
}

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

function OpenAlbum() {
  const { t } = useTranslation('planner')
  const id = useOpenAlbumId()
  if (!id) return null
  return (
    <LazyOverlay name={t('albumName')} onClose={closeAlbum}>
      <AlbumDialog key={id} id={id} />
    </LazyOverlay>
  )
}

function OpenImage() {
  const { t } = useTranslation('planner')
  const id = useLightboxId()
  if (!id) return null
  return (
    <LazyOverlay name={t('lightboxName')} onClose={closeLightbox}>
      <Lightbox id={id} />
    </LazyOverlay>
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

function TrayPanel() {
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

function GridPanel({ desktop }: { desktop: boolean }) {
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

export function PlannerPage() {
  const { t } = useTranslation('planner')
  const desktop = useMediaQuery('md')
  const session = usePlanner((state) => state.session)
  const loadFailed = usePlanner((state) => state.loadFailed)
  const hold = useRef<BoardHold>(null)
  usePlannerShortcuts()

  useEffect(() => {
    const { suspend } = plannerStore.getState()
    const current = holdBoard({ onActive: () => void openBoard(), onElsewhere: suspend })
    hold.current = current
    return () => {
      current.release()
      plannerStore.setState({ session: 'starting' })
    }
  }, [])

  if (loadFailed) {
    return (
      <BoardGate title={t('loadFailedTitle')} description={t('loadFailedDescription')}>
        <Button onClick={() => void openBoard()}>{t('tryAgain')}</Button>
      </BoardGate>
    )
  }

  if (session === 'elsewhere') {
    return (
      <BoardGate title={t('elsewhereTitle')} description={t('elsewhereDescription')}>
        <Button onClick={() => hold.current?.takeOver()}>{t('useHere')}</Button>
      </BoardGate>
    )
  }

  if (session === 'folder') {
    return (
      <AreaBoundary>
        <Suspense>
          <FolderGate />
        </Suspense>
      </AreaBoundary>
    )
  }

  return (
    <BoardDrag>
      <div className={cn('flex', !desktop && 'flex-col')}>
        <h1 className="sr-only">{t('title')}</h1>
        <ImportTargets />
        <SaveFailure />
        <SharedTooltip handle={cellTooltip} />
        <OpenImage />
        <OpenAlbum />
        <CellMenu />
        <SelectionBar />
        {desktop && <TrayPanel />}
        <GridPanel desktop={desktop} />
      </div>
    </BoardDrag>
  )
}
