import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback } from 'react'

import type { Container } from './board'

interface CellDrag {
  id: string
  container: Container
  roleDescription: string
  /** It can still be dropped beside, so only the dragging goes. */
  locked: boolean
}

export function useCellDrag({ id, container, roleDescription, locked }: CellDrag) {
  // A group, not the library's button, because a cell holds buttons of its own.
  const {
    attributes,
    listeners,
    setNodeRef: dragRef,
    setActivatorNodeRef: keyRef,
    isDragging
  } = useDraggable({ id, disabled: locked, attributes: { role: 'group', roleDescription } })
  const { setNodeRef: dropRef } = useDroppable({ id, data: { container, isCell: true } })
  const ref = useCallback(
    (node: HTMLElement | null) => {
      dragRef(node)
      dropRef(node)
      // Marks where keys count, so Space on one of the cell's buttons does not pick the cell up.
      keyRef(node)
    },
    [dragRef, dropRef, keyRef]
  )
  // The tray's drawer takes a finger's moves for its own swipe to close, and keeps them to itself.
  const dropArea = { 'data-drop-id': id, 'data-base-ui-swipe-ignore': true }
  return { ref, attributes, listeners, isDragging, dropArea }
}

export function useDropArea(container: Container) {
  const { setNodeRef } = useDroppable({ id: container, data: { container, isCell: false } })
  return { ref: setNodeRef, dropArea: { 'data-drop-id': container } }
}
