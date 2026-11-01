import { ChevronsLeft, ChevronsRight, Eraser, Shuffle, Smartphone } from 'lucide-react'
import { lazy, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { LazyOverlay } from '@/components/lazy-overlay'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Group } from '@/components/ui/group'
import { SortMenu } from '@/features/autosort/sort-menu'

import type { Container } from './board'
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
  const count = usePlanner((state) => state.board[container].length)
  const MoveAll = container === 'tray' ? ChevronsRight : ChevronsLeft
  return (
    <Group aria-label={t(actionsLabels[container])}>
      <IconButton
        variant="outline"
        label={t(moveAllLabels[container])}
        disabled={count === 0}
        onClick={() => plannerStore.getState().moveAll(container)}
      >
        <MoveAll />
      </IconButton>
      <IconButton
        variant="outline"
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
      <IconButton variant="outline" label={t('phonePreview')} onClick={() => setOpen(true)}>
        <Smartphone />
      </IconButton>
      {open && (
        <LazyOverlay onClose={() => setOpen(false)}>
          <PhonePreview onClose={() => setOpen(false)} />
        </LazyOverlay>
      )}
    </>
  )
}

export function ClearBoard() {
  const { t } = useTranslation('planner')
  const [open, setOpen] = useState(false)
  const tray = usePlanner((state) => state.board.tray.length)
  const grid = usePlanner((state) => state.board.grid.length)
  const clear = (containers: Container[]) => {
    plannerStore.getState().clear(containers)
    setOpen(false)
  }
  return (
    <>
      <IconButton
        variant="outline"
        label={t('clear')}
        disabled={tray + grid === 0}
        onClick={() => setOpen(true)}
      >
        <Eraser />
      </IconButton>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('clearDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>{t('cancel')}</AlertDialogClose>
            <Button variant="outline" disabled={tray === 0} onClick={() => clear(['tray'])}>
              {t('trayCount', { count: tray })}
            </Button>
            <Button variant="outline" disabled={grid === 0} onClick={() => clear(['grid'])}>
              {t('gridCount', { count: grid })}
            </Button>
            <Button variant="destructive" onClick={() => clear(['tray', 'grid'])}>
              {t('bothCount', { count: tray + grid })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  )
}
