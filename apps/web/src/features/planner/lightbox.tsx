import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { AnimatePresence, m, type PanInfo } from 'motion/react'
import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import {
  Dialog,
  DialogBackdrop,
  DialogPortal,
  DialogPrimitive,
  DialogTitle
} from '@/components/ui/dialog'
import { Group } from '@/components/ui/group'
import { useDialogPresence } from '@/hooks/use-dialog-presence'

import { AlbumStrip } from './album-strip'
import { cellOf, containerOf, imagesOf } from './board'
import { ImageDetails, Pill } from './lightbox-details'
import { closeLightbox, openLightbox } from './lightbox-store'
import { usePlanner } from './planner'
import { FullSizeImage } from './thumbnail'
import { useZoom } from './use-zoom'

// How far a drag at normal size has to go to count as a swipe to the next image, in pixels.
const SWIPE_DISTANCE = 80

// For a pointer that cannot drag (WCAG 2.5.7). Each does what its arrow key does.
const PAN_BUTTONS = [
  { key: 'ArrowLeft', label: 'panLeft', icon: ArrowLeft },
  { key: 'ArrowUp', label: 'panUp', icon: ArrowUp },
  { key: 'ArrowDown', label: 'panDown', icon: ArrowDown },
  { key: 'ArrowRight', label: 'panRight', icon: ArrowRight }
] as const

export function Lightbox({ id }: { id: string }) {
  const { t } = useTranslation('planner')
  const { dialog, close } = useDialogPresence(closeLightbox)
  const board = usePlanner((state) => state.board)
  const { cells, cell, images } = useMemo(() => {
    const cell = cellOf(board, id)
    const cells = board[containerOf(board, cell)]
    // An album's images come one after another, so that stepping goes through it and out again.
    return { cells, cell, images: cells.flatMap((each) => imagesOf(board, each)) }
  }, [board, id])
  const index = cells.indexOf(cell)
  const stepIndex = images.indexOf(id)
  const previous = images[stepIndex - 1]
  const next = images[stepIndex + 1]
  const album = board.albums?.[cell]

  const { zoom, zoomed, canZoomIn, motion, reach, zoomIn, zoomOut, reset, wheel, pan } = useZoom()
  const popup = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)

  const step = (cell: string | undefined) => {
    if (!cell) return
    reset()
    openLightbox(cell)
  }

  const keydown = ({ key }: KeyboardEvent) => {
    // As with a drag, a zoomed picture is looked around and not left.
    if (zoomed) return pan(key)
    if (key === 'ArrowLeft') step(previous)
    if (key === 'ArrowRight') step(next)
  }

  const swipe = (_event: unknown, { offset }: PanInfo) => {
    if (zoomed) return
    if (offset.x > SWIPE_DISTANCE) step(previous)
    if (offset.x < -SWIPE_DISTANCE) step(next)
  }

  // Letting go of a drag is a click too, wherever it ends.
  const closeOutside = ({ target }: MouseEvent) => {
    if (!dragged.current && 'outside' in (target as HTMLElement).dataset) close()
  }

  // A button disabled under focus takes the keyboard with it, and these keys are handled up here.
  useEffect(() => {
    const focused = document.activeElement
    if (!focused || focused === document.body || focused.matches(':disabled')) {
      popup.current?.focus()
    }
  }, [zoom, id])

  return (
    <Dialog {...dialog}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPrimitive.Popup
          ref={popup}
          aria-label={t('cell', { position: index + 1 })}
          data-outside
          initialFocus={popup}
          className="fixed inset-0 z-50 flex flex-col transition-opacity duration-200 outline-none data-ending-style:opacity-0 data-starting-style:opacity-0"
          onKeyDown={keydown}
          onPointerDownCapture={() => (dragged.current = false)}
          onClick={closeOutside}
        >
          <DialogTitle className="sr-only">{t('cell', { position: index + 1 })}</DialogTitle>
          <div data-outside className="flex items-center justify-between gap-2 p-4">
            <div data-outside className="flex flex-1 flex-wrap items-center gap-2">
              <Pill>{t('lightboxPosition', { position: index + 1, total: cells.length })}</Pill>
              {album && (
                <Pill>
                  <Layers aria-hidden className="size-3.5 text-muted-foreground" />
                  {t('lightboxAlbumPosition', {
                    position: album.indexOf(id) + 1,
                    total: album.length
                  })}
                </Pill>
              )}
              <ImageDetails id={id} />
            </div>
            <div className="flex shrink-0 gap-2">
              <Group aria-label={t('zoom')}>
                <IconButton
                  variant="outline"
                  label={t('zoomOut')}
                  disabled={!zoomed}
                  onClick={zoomOut}
                >
                  <ZoomOut />
                </IconButton>
                <IconButton
                  variant="outline"
                  label={t('zoomIn')}
                  disabled={!canZoomIn}
                  onClick={zoomIn}
                >
                  <ZoomIn />
                </IconButton>
              </Group>
              <IconButton variant="outline" label={t('close')} onClick={close}>
                <X />
              </IconButton>
            </div>
          </div>
          <div
            data-outside
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            onWheel={wheel}
          >
            <m.div
              data-outside
              className="flex size-full items-center justify-center p-4"
              drag
              dragMomentum={false}
              dragElastic={zoomed ? 0.1 : 0.4}
              dragSnapToOrigin={!zoomed}
              dragConstraints={{
                left: -reach.x,
                right: reach.x,
                top: -reach.y,
                bottom: reach.y
              }}
              onDragStart={() => (dragged.current = true)}
              onDragEnd={swipe}
              style={motion}
              data-zoom={zoom}
            >
              <FullSizeImage
                id={id}
                label={t('cell', { position: index + 1 })}
                className="max-h-full max-w-full"
              />
            </m.div>
            <IconButton
              variant="outline"
              className="absolute left-4"
              label={t('previous')}
              disabled={!previous}
              onClick={() => step(previous)}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              variant="outline"
              className="absolute right-4"
              label={t('next')}
              disabled={!next}
              onClick={() => step(next)}
            >
              <ChevronRight />
            </IconButton>
            {zoomed && (
              <Group aria-label={t('pan')} className="absolute top-4 right-4">
                {PAN_BUTTONS.map(({ key, label, icon: Icon }) => (
                  <IconButton key={key} variant="outline" label={t(label)} onClick={() => pan(key)}>
                    <Icon />
                  </IconButton>
                ))}
              </Group>
            )}
            <AnimatePresence>
              {album && <AlbumStrip key={cell} images={album} current={id} onPick={step} />}
            </AnimatePresence>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
