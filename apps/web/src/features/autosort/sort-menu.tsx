import { Palette } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconMenu } from '@/components/icon-menu'
import { anchoredToastManager } from '@/components/ui/toast'
import type { Container } from '@/features/planner/board'
import { plannerStore } from '@/features/planner/planner'

import { sortStrategies, type SortStrategy } from './sort'

const UNDO_OFFER_MS = 6000

const labels = { tray: 'sortTray', grid: 'sortGrid' } as const

interface SortMenuProps {
  container: Container
  disabled: boolean
}

export function SortMenu({ container, disabled }: SortMenuProps) {
  const { t } = useTranslation('planner')
  const trigger = useRef<HTMLButtonElement>(null)

  const offerUndo = () => {
    const id = anchoredToastManager.add({
      title: t('sorted'),
      timeout: UNDO_OFFER_MS,
      positionerProps: { anchor: trigger.current },
      actionProps: {
        children: t('undo'),
        onClick: () => plannerStore.getState().undo()
      },
      onClose: () => stopWatching()
    })
    const stopWatching = plannerStore.subscribe(({ board }, { board: previous }) => {
      if (board !== previous) anchoredToastManager.close(id)
    })
  }

  const sort = async (strategy: SortStrategy) => {
    const { board } = plannerStore.getState()
    await plannerStore.getState().sortByColour(container, strategy)
    if (plannerStore.getState().board !== board) offerUndo()
  }

  return (
    <IconMenu
      label={t(labels[container])}
      icon={<Palette />}
      disabled={disabled}
      triggerRef={trigger}
      items={sortStrategies.map((strategy) => ({
        label: t(`sort.${strategy}`),
        onClick: () => void sort(strategy)
      }))}
    />
  )
}
