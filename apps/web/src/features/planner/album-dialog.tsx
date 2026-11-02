import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Ungroup, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle
} from '@/components/ui/dialog'
import { useDialogPresence } from '@/hooks/use-dialog-presence'
import { cn } from '@/lib/utils'

import { closeAlbum } from './album-store'
import { isLocked } from './board'
import { dragAnnouncements } from './drag-announcements'
import { cellShape } from './network-profile'
import { plannerStore, usePlanner } from './planner'
import { Thumbnail } from './thumbnail'
import { useCellSensors } from './use-cell-sensors'

interface AlbumTileProps {
  album: string
  image: string
  position: number
  locked: boolean
}

function AlbumTile({ album, image, position, locked }: AlbumTileProps) {
  const { t } = useTranslation('planner')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image,
    disabled: locked,
    data: { isCell: true },
    attributes: { role: 'group', roleDescription: t('cellRole') }
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={t('albumImage', { position })}
      className={cn(
        'group relative touch-manipulation overflow-hidden rounded-sm bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        !locked && 'cursor-grab active:cursor-grabbing',
        isDragging && 'z-10 shadow-lg'
      )}
      style={{ ...cellShape, transform: CSS.Translate.toString(transform), transition }}
    >
      <Thumbnail id={image} label={t('albumImage', { position })} />
      {position === 1 && (
        <span className="pointer-events-none absolute bottom-1 left-1 rounded-sm bg-background px-1 py-0.5 text-xs/3 text-foreground shadow-xs">
          {t('albumCover')}
        </span>
      )}
      {!locked && (
        <IconButton
          variant="outline"
          size="icon-xs"
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          label={t('takeFromAlbum')}
          onClick={() => plannerStore.getState().takeFromAlbum(album, image)}
        >
          <X />
        </IconButton>
      )}
    </div>
  )
}

export function AlbumDialog({ id }: { id: string }) {
  const { t } = useTranslation('planner')
  const { dialog, close } = useDialogPresence(closeAlbum)
  const images = usePlanner(({ board }) => board.albums?.[id])
  const locked = usePlanner(({ board }) => isLocked(board, id))
  const sensors = useCellSensors()
  const accessibility = useMemo(() => {
    const place = (image: string) => {
      const position = (plannerStore.getState().board.albums?.[id] ?? []).indexOf(image) + 1
      return t('albumImage', { position })
    }
    return {
      announcements: dragAnnouncements(t, place),
      screenReaderInstructions: { draggable: t('albumDragInstructions') }
    }
  }, [id, t])

  // Taking out the last image but one leaves no album to edit.
  useEffect(() => {
    if (!images) close()
  }, [images, close])
  if (!images) return null

  const reorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = images.indexOf(String(active.id))
    const to = images.indexOf(String(over.id))
    plannerStore.getState().reorderAlbum(id, arrayMove(images, from, to))
  }

  return (
    <Dialog {...dialog}>
      {/* It keeps arrow keys inside, and a keyboard drag listens for them on the document. */}
      <DialogPopup onKeyDown={(event) => event.preventBaseUIHandler()}>
        <DialogHeader>
          <DialogTitle>{t('albumOf', { count: images.length })}</DialogTitle>
          <DialogDescription>{t(locked ? 'albumLocked' : 'albumHelp')}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={accessibility}
            onDragEnd={reorder}
          >
            <SortableContext items={images} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
                {images.map((image, index) => (
                  <AlbumTile
                    key={image}
                    album={id}
                    image={image}
                    position={index + 1}
                    locked={locked}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </DialogPanel>
        {!locked && (
          <DialogFooter>
            <Button variant="outline" onClick={() => plannerStore.getState().ungroup(id)}>
              <Ungroup />
              {t('ungroup')}
            </Button>
          </DialogFooter>
        )}
      </DialogPopup>
    </Dialog>
  )
}
