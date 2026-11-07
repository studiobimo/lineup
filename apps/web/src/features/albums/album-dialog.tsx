import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRight, Ungroup, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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

import { isLocked } from '@/features/planner/board'
import { dragAnnouncements } from '@/features/planner/drag-announcements'
import { cellShape } from '@/features/planner/network-profile'
import { plannerStore, usePlanner } from '@/features/planner/planner'
import { Thumbnail } from '@/features/planner/thumbnail'
import { useCellSensors } from '@/features/planner/use-cell-sensors'

import { closeAlbum } from './album-store'

interface AlbumTileProps {
  album: string
  image: string
  position: number
  count: number
  locked: boolean
}

const tileButton =
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'

function AlbumTile({ album, image, position, count, locked }: AlbumTileProps) {
  const { t } = useTranslation(['albums', 'planner'])
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image,
    disabled: locked,
    data: { isCell: true },
    animateLayoutChanges: () => true,
    attributes: { role: 'group', roleDescription: t('planner:cellRole') }
  })
  const shift = (step: 1 | -1) => {
    const { board, reorderAlbum } = plannerStore.getState()
    const images = board.albums?.[album] ?? []
    reorderAlbum(album, arrayMove(images, position - 1, position - 1 + step))
  }
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={t('image', { position })}
      className={cn(
        'group relative touch-manipulation overflow-hidden rounded-sm bg-muted focus-visible:photo-outline',
        !locked && 'cursor-grab active:cursor-grabbing',
        isDragging && 'z-10 shadow-lg'
      )}
      style={{ ...cellShape, transform: CSS.Translate.toString(transform), transition }}
    >
      <Thumbnail id={image} label={t('image', { position })} />
      {position === 1 && (
        <span className="pointer-events-none absolute bottom-1 left-1 rounded-sm bg-background px-1 py-0.5 text-xs/3 text-foreground shadow-xs">
          {t('cover')}
        </span>
      )}
      {!locked && (
        <>
          {/* For a pointer that cannot drag (WCAG 2.5.7). The keyboard has Space on the tile. */}
          <div className="absolute top-1 left-1 flex gap-1">
            {position > 1 && (
              <IconButton
                variant="outline"
                size="icon-xs"
                tabIndex={-1}
                className={tileButton}
                label={t('planner:moveEarlier')}
                onClick={() => shift(-1)}
              >
                <ArrowLeft />
              </IconButton>
            )}
            {position < count && (
              <IconButton
                variant="outline"
                size="icon-xs"
                tabIndex={-1}
                className={tileButton}
                label={t('planner:moveLater')}
                onClick={() => shift(1)}
              >
                <ArrowRight />
              </IconButton>
            )}
          </div>
          <IconButton
            variant="outline"
            size="icon-xs"
            className={cn('absolute top-1 right-1', tileButton)}
            label={t('takeOut')}
            onClick={() => plannerStore.getState().takeFromAlbum(album, image)}
          >
            <X />
          </IconButton>
        </>
      )}
    </div>
  )
}

export function AlbumDialog({ id }: { id: string }) {
  const { t } = useTranslation(['albums', 'planner'])
  const { t: planner } = useTranslation('planner')
  const { dialog, close } = useDialogPresence(closeAlbum)
  const album = usePlanner(({ board }) => board.albums?.[id])
  // What goes on showing while it closes, because closing finishes only once its exit has played.
  const [images, setImages] = useState(album)
  if (album && album !== images) setImages(album)
  const locked = usePlanner(({ board }) => isLocked(board, id))
  const sensors = useCellSensors()
  const accessibility = useMemo(() => {
    const place = (image: string) => {
      const position = (plannerStore.getState().board.albums?.[id] ?? []).indexOf(image) + 1
      return t('image', { position })
    }
    return {
      announcements: dragAnnouncements(planner, place),
      screenReaderInstructions: { draggable: t('dragInstructions') }
    }
  }, [id, t, planner])

  // Taking out the last image but one leaves no album to edit.
  useEffect(() => {
    if (!album) close()
  }, [album, close])
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
          <DialogTitle>{t('planner:albumOf', { count: images.length })}</DialogTitle>
          <DialogDescription>{t(locked ? 'locked' : 'help')}</DialogDescription>
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
                    count={images.length}
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
              {t('planner:ungroup')}
            </Button>
          </DialogFooter>
        )}
      </DialogPopup>
    </Dialog>
  )
}
