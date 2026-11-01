import { useEffect } from 'react'

import { inTextField } from '@/lib/dom'

import { dragStore } from './drag-target'
import { plannerStore } from './planner'
import { shortcutFor } from './shortcuts'

export function usePlannerShortcuts() {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
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
