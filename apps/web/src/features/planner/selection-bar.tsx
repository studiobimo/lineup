import { Layers, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useStore } from 'zustand'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import { lastingToast } from '@/lib/lasting-toast'

import { groupProblem, inBoardOrder } from './board'
import { BottomBar } from './bottom-bar'
import { selectionContext } from './cell-actions'
import { dragStore } from './drag-target'
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { type ActionRowsProps, useActionRows } from './use-action-rows'
import { clearSelection, selectedCells, useSelectionSize } from './selection-store'

function ActionButtons({ act, ...rows }: ActionRowsProps & { act: (action: () => void) => void }) {
  return useActionRows(rows).map(({ key, Icon, text, run }) => (
    <Button key={key} variant="ghost" size="sm" onClick={() => act(run)}>
      <Icon />
      {text}
    </Button>
  ))
}

function SelectionActions({ count }: { count: number }) {
  const { t } = useTranslation('planner')
  const { board } = plannerStore.getState()
  const chosen = selectedCells()
  const context = selectionContext(board, chosen)
  const act = (action: () => void) => {
    action()
    clearSelection()
  }
  const groupSelection = () => {
    const cells = inBoardOrder(board, chosen)
    const problem = groupProblem(board, cells)
    if (problem) {
      const limit = instagram.carouselLimit
      lastingToast({ type: 'warning', title: t(`groupRefused.${problem}`, { limit }) })
    } else act(() => plannerStore.getState().group(cells))
  }
  return (
    <BottomBar
      role="toolbar"
      aria-label={t('selectionActions')}
      className="flex items-center gap-1 rounded-lg p-1"
    >
      <p aria-live="polite" className="px-2 text-sm whitespace-nowrap">
        {t('selected', { count })}
      </p>
      <ActionButtons surface="selectionMove" context={context} act={act} />
      <Button variant="ghost" size="sm" onClick={groupSelection}>
        <Layers />
        {t('group')}
      </Button>
      <ActionButtons surface="selectionRemove" context={context} act={act} />
      <IconButton
        variant="ghost"
        size="icon-sm"
        label={t('clearSelection')}
        onClick={clearSelection}
      >
        <X />
      </IconButton>
    </BottomBar>
  )
}

export function SelectionBar() {
  const count = useSelectionSize()
  const dragging = useStore(dragStore, (state) => state.dragging)
  return (
    <AnimatePresence>
      {count > 0 && !dragging && <SelectionActions key="selection" count={count} />}
    </AnimatePresence>
  )
}
