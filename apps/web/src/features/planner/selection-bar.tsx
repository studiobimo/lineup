import { ArrowRightLeft, Layers, Trash2, X } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useStore } from 'zustand'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import { toastManager } from '@/components/ui/toast'

import { containerOf, groupProblem, inBoardOrder } from './board'
import { dragStore } from './drag-target'
import { settle } from './motion'
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { clearSelection, selectedCells, useSelectionSize } from './selection-store'

function SelectionActions({ count }: { count: number }) {
  const { t } = useTranslation('planner')
  const { board, moveCells, remove } = plannerStore.getState()
  const chosen = selectedCells()
  const inTray = chosen.some((cell) => containerOf(board, cell) === 'tray')
  const inGrid = chosen.some((cell) => containerOf(board, cell) === 'grid')
  // An action ends the selection, as cells that moved away are no longer where they were chosen.
  const act = (action: () => void) => {
    action()
    clearSelection()
  }
  const groupSelection = () => {
    const cells = inBoardOrder(board, chosen)
    const problem = groupProblem(board, cells)
    if (problem) {
      const limit = instagram.carouselLimit
      toastManager.add({ type: 'warning', title: t(`groupRefused.${problem}`, { limit }) })
    } else act(() => plannerStore.getState().group(cells))
  }
  return (
    <m.div
      role="toolbar"
      aria-label={t('selectionActions')}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={settle}
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
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
    </m.div>
  )
}

/** Out of the way of a drag, which has a hint in the same place and is not about the selection. */
export function SelectionBar() {
  const count = useSelectionSize()
  const dragging = useStore(dragStore, (state) => state.dragging)
  return (
    <AnimatePresence>
      {count > 0 && !dragging && <SelectionActions key="selection" count={count} />}
    </AnimatePresence>
  )
}
