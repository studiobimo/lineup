import { ArrowRightLeft, Layers, Trash2, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useStore } from 'zustand'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import { lastingToast } from '@/lib/lasting-toast'

import { containerOf, groupProblem, inBoardOrder } from './board'
import { BottomBar } from './bottom-bar'
import { dragStore } from './drag-target'
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { clearSelection, selectedCells, useSelectionSize } from './selection-store'

function SelectionActions({ count }: { count: number }) {
  const { t } = useTranslation('planner')
  const { board, moveCells, remove } = plannerStore.getState()
  const chosen = selectedCells()
  const inTray = chosen.some((cell) => containerOf(board, cell) === 'tray')
  const inGrid = chosen.some((cell) => containerOf(board, cell) === 'grid')
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
      {inTray && (
        <Button variant="ghost" size="sm" onClick={() => act(() => moveCells(chosen, 'grid'))}>
          <ArrowRightLeft />
          {t('moveToGrid')}
        </Button>
      )}
      {inGrid && (
        <Button variant="ghost" size="sm" onClick={() => act(() => moveCells(chosen, 'tray'))}>
          <ArrowRightLeft />
          {t('moveToTray')}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={groupSelection}>
        <Layers />
        {t('group')}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => act(() => remove(chosen))}>
        <Trash2 />
        {t('remove')}
      </Button>
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
