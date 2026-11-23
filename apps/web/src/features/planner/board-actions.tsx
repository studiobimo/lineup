import { ChevronsLeft, ChevronsRight, Shuffle, Smartphone, Trash2 } from 'lucide-react'
import { lazy, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { IconButton } from '@/components/icon-button'
import { LazyOverlay } from '@/components/lazy-overlay'
import { Button } from '@/components/ui/button'
import { Group } from '@/components/ui/group'
import { SortMenu } from '@/features/autosort/sort-menu'

import { type Container, freeCells, imagesIn, lockedCells } from './board'
import { plannerStore, usePlanner } from './planner'

const PhonePreview = lazy(() =>
  import('./phone-preview').then(({ PhonePreview }) => ({ default: PhonePreview }))
)

const moveAllLabels = { tray: 'moveAllToGrid', grid: 'moveAllToTray' } as const
const shuffleLabels = { tray: 'shuffleTray', grid: 'shuffleGrid' } as const
const actionsLabels = { tray: 'trayActions', grid: 'gridActions' } as const

interface ContainerActionsProps {
  container: Container
  children?: ReactNode
}

export function ContainerActions({ container, children }: ContainerActionsProps) {
  const { t } = useTranslation('planner')
  const count = usePlanner(({ board }) => freeCells(board, container).length)
  const MoveAll = container === 'tray' ? ChevronsRight : ChevronsLeft
  return (
    <Group aria-label={t(actionsLabels[container])}>
      <IconButton
        label={t(moveAllLabels[container])}
        disabled={count === 0}
        onClick={() => plannerStore.getState().moveAll(container)}
      >
        <MoveAll />
      </IconButton>
      <IconButton
        label={t(shuffleLabels[container])}
        disabled={count < 2}
        onClick={() => plannerStore.getState().shuffle(container)}
      >
        <Shuffle />
      </IconButton>
      <SortMenu container={container} disabled={count < 2} />
      {children}
    </Group>
  )
}

export function PreviewOnPhone() {
  const { t } = useTranslation('planner')
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={t('phonePreview')} onClick={() => setOpen(true)}>
        <Smartphone />
      </IconButton>
      {open && (
        <LazyOverlay name={t('phonePreviewName')} onClose={() => setOpen(false)}>
          <PhonePreview onClose={() => setOpen(false)} />
        </LazyOverlay>
      )}
    </>
  )
}

function useClearing() {
  const [open, setOpen] = useState(false)
  const locked = usePlanner(({ board }) => lockedCells(board).size)
  const clear = (containers: Container[]) => {
    plannerStore.getState().clear(containers)
    setOpen(false)
  }
  return {
    open,
    setOpen,
    clear,
    description: locked > 0 ? 'clearDescriptionLocked' : 'clearDescription'
  }
}

export function ClearBoard() {
  const { t } = useTranslation('planner')
  const { open, setOpen, clear, description } = useClearing()
  const tray = usePlanner(({ board }) => imagesIn(board, 'tray').length)
  const grid = usePlanner(({ board }) => imagesIn(board, 'grid').length)
  return (
    <>
      <IconButton label={t('clear')} disabled={tray + grid === 0} onClick={() => setOpen(true)}>
        <Trash2 />
      </IconButton>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('clearTitle')}
        description={t(description)}
        cancelLabel={t('cancel')}
        actions={
          <>
            <Button variant="outline" disabled={tray === 0} onClick={() => clear(['tray'])}>
              {t('trayCount', { count: tray })}
            </Button>
            <Button variant="outline" disabled={grid === 0} onClick={() => clear(['grid'])}>
              {t('gridCount', { count: grid })}
            </Button>
            <Button variant="destructive" onClick={() => clear(['tray', 'grid'])}>
              {t('bothCount', { count: tray + grid })}
            </Button>
          </>
        }
      />
    </>
  )
}

export function ClearTray() {
  const { t } = useTranslation('planner')
  const { open, setOpen, clear, description } = useClearing()
  const tray = usePlanner(({ board }) => imagesIn(board, 'tray').length)
  return (
    <>
      <IconButton label={t('clearTray')} disabled={tray === 0} onClick={() => setOpen(true)}>
        <Trash2 />
      </IconButton>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('clearTrayTitle')}
        description={t(description)}
        cancelLabel={t('cancel')}
        confirmLabel={t('trayCount', { count: tray })}
        onConfirm={() => clear(['tray'])}
      />
    </>
  )
}
