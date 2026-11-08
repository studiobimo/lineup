import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback } from 'react'

import type { Container } from './board'

interface CellDrag {
  id: string
  container: Container
  roleDescription: string
  locked: boolean
}

export function useCellDrag({ id, container, roleDescription, locked }: CellDrag) {
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
      keyRef(node)
    },
    [dragRef, dropRef, keyRef]
  )
  const dropArea = { 'data-drop-id': id, 'data-base-ui-swipe-ignore': true }
  return { ref, attributes, listeners, isDragging, dropArea }
}

export function useDropArea(container: Container) {
  const { setNodeRef } = useDroppable({ id: container, data: { container, isCell: false } })
  return { ref: setNodeRef, dropArea: { 'data-drop-id': container } }
}
