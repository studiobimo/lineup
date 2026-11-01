import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback } from 'react'

import type { Container } from './board'

export function useCellDrag(id: string, container: Container) {
  const { listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id })
  const { setNodeRef: dropRef } = useDroppable({ id, data: { container, isCell: true } })
  const ref = useCallback(
    (node: HTMLElement | null) => {
      dragRef(node)
      dropRef(node)
    },
    [dragRef, dropRef]
  )
  return { ref, listeners, isDragging, dropArea: { 'data-drop-id': id } }
}

export function useDropArea(container: Container) {
  const { setNodeRef } = useDroppable({ id: container, data: { container, isCell: false } })
  return { ref: setNodeRef, dropArea: { 'data-drop-id': container } }
}
