import { Suspense, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { AreaBoundary } from '@/components/area-boundary'
import { SharedTooltip } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'
import { loadStrings } from '@/i18n/load-strings'
import { lazyComponent } from '@/lib/lazy-component'
import { cn } from '@/lib/utils'

import { BoardDrag } from './board-drag'
import { BoardGate } from './board-gate'
import { type BoardHold, holdBoard } from './board-lock'
import { GridPanel, TrayPanel } from './board-panels'
import { cellTooltip } from './cell-tooltip'
import { ImportTargets } from './import-controls'
import { openBoard } from './open-board'
import { plannerStore, usePlanner } from './planner'
import { PlannerOverlays } from './planner-overlays'
import { SaveFailure } from './save-failure'
import { SelectionBar } from './selection-bar'
import { usePlannerShortcuts } from './use-planner-shortcuts'

const FolderGate = lazyComponent(
  () => import('./folder-gate').then(({ FolderGate }) => FolderGate),
  () => loadStrings('settings')
)

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
        <PlannerOverlays />
        <SelectionBar />
        {desktop && <TrayPanel />}
        <GridPanel desktop={desktop} />
      </div>
    </BoardDrag>
  )
}
