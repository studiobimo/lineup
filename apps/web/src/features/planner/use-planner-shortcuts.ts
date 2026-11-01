import { useEffect } from 'react'

import { inTextField } from '@/lib/dom'

import { dragStore } from './drag-target'
import { plannerStore } from './planner'
import { isDelete, shortcutFor } from './shortcuts'

/** Focus moves on to the next cell, so a run of deletes does not start again from the top. */
function removeCell(cell: HTMLElement) {
  const next = cell.nextElementSibling ?? cell.previousElementSibling
  const { dropId } = cell.dataset
  if (dropId) plannerStore.getState().remove([dropId])
  if (next instanceof HTMLElement) next.focus()
}

export function usePlannerShortcuts() {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isDelete(event) && event.target instanceof HTMLElement && event.target.dataset.dropId) {
        event.preventDefault()
        if (!dragStore.getState().dragging) removeCell(event.target)
        return
      }
      const shortcut = shortcutFor(event)
      if (!shortcut || inTextField(event.target)) return
      event.preventDefault()
      // A board that changes under a drag would drop the cell somewhere the user never aimed at.
      if (dragStore.getState().dragging) return
      plannerStore.getState()[shortcut]()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])
}
