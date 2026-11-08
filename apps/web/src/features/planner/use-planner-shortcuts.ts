import { useEffect } from 'react'

import { dialogIsOpen, inTextField } from '@/lib/dom'

import { isLocked } from './board'
import { openCellMenu } from './cell-menu-store'
import { dragStore } from './drag-target'
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { clearSelection, selectedCells } from './selection-store'
import { cellStep, isDelete, shortcutFor } from './shortcuts'

function removeCell(cell: HTMLElement) {
  const next = cell.nextElementSibling ?? cell.previousElementSibling
  const { dropId } = cell.dataset
  const { board, remove } = plannerStore.getState()
  if (!dropId || isLocked(board, dropId)) return
  const selected = selectedCells()
  remove(selected.includes(dropId) ? selected : [dropId])
  if (next instanceof HTMLElement) next.focus()
}

function focusNeighbour(cell: HTMLElement, key: string) {
  const cells = [...(cell.parentElement?.children ?? [])]
  const target = cellStep(key, cells.indexOf(cell), cells.length, instagram.columns)
  if (target === null) return false
  ;(cells[target] as HTMLElement).focus()
  return true
}

export function usePlannerShortcuts() {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const { target, key } = event
      const dropId = target instanceof HTMLElement ? target.dataset.dropId : undefined
      if (target instanceof HTMLElement && dropId) {
        if (isDelete(event)) {
          event.preventDefault()
          if (!dragStore.getState().dragging) removeCell(target)
          return
        }
        if (!event.defaultPrevented && !dragStore.getState().dragging) {
          if (key === 'Enter') {
            event.preventDefault()
            openCellMenu({ id: dropId, cell: target })
            return
          }
          const plain = !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey
          if (plain && focusNeighbour(target, key)) {
            event.preventDefault()
            return
          }
        }
      }
      if (key === 'Escape' && !dialogIsOpen() && !dragStore.getState().dragging) clearSelection()
      const shortcut = shortcutFor(event)
      if (!shortcut || inTextField(event.target) || dialogIsOpen()) return
      event.preventDefault()
      if (dragStore.getState().dragging) return
      plannerStore.getState()[shortcut]()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])
}
