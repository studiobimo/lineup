import { Palette } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu'
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
    // Undo takes back the latest change, so after any other change this offer would be a lie.
    const stopWatching = plannerStore.subscribe(({ board }, { board: previous }) => {
      if (board !== previous) anchoredToastManager.close(id)
    })
  }

  const sort = (strategy: SortStrategy) => {
    const { board } = plannerStore.getState()
    plannerStore.getState().sortByColour(container, strategy)
    if (plannerStore.getState().board !== board) offerUndo()
  }

  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={
          <IconButton ref={trigger} variant="outline" label={t(labels[container])}>
            <Palette />
          </IconButton>
        }
      />
      <MenuPopup>
        {sortStrategies.map((strategy) => (
          <MenuItem key={strategy} onClick={() => sort(strategy)}>
            {t(`sort.${strategy}`)}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  )
}
