import { closestCenter, DndContext, type DragEndEvent, type Modifier } from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { dragAnnouncements } from '@/features/planner/drag-announcements'
import { instagram } from '@/features/planner/network-profile'
import { plannerStore } from '@/features/planner/planner'
import { Thumbnail } from '@/features/planner/thumbnail'
import { useCellSensors } from '@/features/planner/use-cell-sensors'
import { cn } from '@/lib/utils'

import type { Slide } from './slide-viewer'

const { width, height } = instagram.cellRatio

const horizontalOnly: Modifier = ({ transform }) => ({ ...transform, y: 0 })

interface SlideStripProps {
  cell: string
  slides: Slide[]
  index: number
  onIndexChange: (index: number) => void
}

interface StripItemProps {
  id: string
  position: number
  current: boolean
  onSelect: () => void
}

function StripItem({ id, position, current, onSelect }: StripItemProps) {
  const { t } = useTranslation(['provider', 'planner'])
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { isCell: true },
    animateLayoutChanges: () => true,
    attributes: { role: 'button', roleDescription: t('planner:cellRole') }
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={t('provider:post.strip.slide', { position })}
      aria-current={current}
      className={cn(
        'relative w-14 shrink-0 cursor-grab touch-manipulation overflow-hidden rounded-sm bg-muted active:cursor-grabbing focus-visible:photo-outline',
        current && 'ring-2 ring-primary',
        isDragging && 'z-10 shadow-lg'
      )}
      style={{
        aspectRatio: `${width} / ${height}`,
        transform: CSS.Translate.toString(transform),
        transition
      }}
      onClick={onSelect}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event)
        if (event.key === 'Enter' && !isDragging) onSelect()
      }}
    >
      <Thumbnail id={id} label={t('provider:post.strip.slide', { position })} />
    </div>
  )
}

export function SlideStrip({ cell, slides, index, onIndexChange }: SlideStripProps) {
  const { t } = useTranslation('provider')
  const { t: planner } = useTranslation('planner')
  const sensors = useCellSensors()
  const ids = useMemo(() => slides.map(({ id }) => id), [slides])
  const accessibility = useMemo(() => {
    const place = (id: string) => t('post.strip.slide', { position: ids.indexOf(id) + 1 })
    return {
      announcements: dragAnnouncements(planner, place),
      screenReaderInstructions: { draggable: t('post.strip.instructions') }
    }
  }, [ids, t, planner])

  if (slides.length < 2) return null

  const reorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    plannerStore.getState().reorderAlbum(cell, arrayMove(ids, from, to))
    onIndexChange(to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[horizontalOnly]}
      accessibility={accessibility}
      onDragEnd={reorder}
    >
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div
          className="flex gap-1 overflow-x-auto overflow-y-hidden p-1"
          aria-label={t('post.strip.label')}
          role="group"
        >
          {ids.map((id, position) => (
            <StripItem
              key={id}
              id={id}
              position={position + 1}
              current={position === index}
              onSelect={() => onIndexChange(position)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
