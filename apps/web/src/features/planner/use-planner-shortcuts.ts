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

function handleCellKey(event: KeyboardEvent, target: HTMLElement, dropId: string) {
  if (isDelete(event)) {
    event.preventDefault()
    if (!dragStore.getState().dragging) removeCell(target)
    return true
  }
  if (event.defaultPrevented || dragStore.getState().dragging) return false
  if (event.key === 'Enter') {
    event.preventDefault()
    openCellMenu({ id: dropId, cell: target })
    return true
  }
  const plain = !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey
  if (!plain || !focusNeighbour(target, event.key)) return false
  event.preventDefault()
  return true
}

function keydown(event: KeyboardEvent) {
  const { target, key } = event
  const dropId = target instanceof HTMLElement ? target.dataset.dropId : undefined
  if (target instanceof HTMLElement && dropId && handleCellKey(event, target, dropId)) return
  if (key === 'Escape' && !dialogIsOpen() && !dragStore.getState().dragging) clearSelection()
  const shortcut = shortcutFor(event)
  if (!shortcut || inTextField(target) || dialogIsOpen()) return
  event.preventDefault()
  if (dragStore.getState().dragging) return
  plannerStore.getState()[shortcut]()
}

export function usePlannerShortcuts() {
  useEffect(() => {
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])
}
