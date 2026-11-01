import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { animate, m, type PanInfo, useMotionValue } from 'motion/react'
import { type KeyboardEvent, useEffect, useState, type WheelEvent } from 'react'
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

import { containerOf } from './board'
import { closeLightbox, openLightbox } from './lightbox-store'
import { settle } from './motion'
import { usePlanner } from './planner'
import { FullSizeImage } from './thumbnail'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 1
const WHEEL_SPEED = 0.002
// How far a drag at normal size has to go to count as a swipe to the next image, in pixels.
const SWIPE_DISTANCE = 80

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export function Lightbox({ id }: { id: string }) {
  const { t } = useTranslation('planner')
  const cells = usePlanner(({ board }) => board[containerOf(board, id)])
  const index = cells.indexOf(id)
  const previous = cells[index - 1]
  const next = cells[index + 1]

  const [zoom, setZoom] = useState(MIN_ZOOM)
  const zoomed = zoom > MIN_ZOOM
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(MIN_ZOOM)

  useEffect(() => {
    animate(scale, zoom, settle)
    if (zoom === MIN_ZOOM) {
      animate(x, 0, settle)
      animate(y, 0, settle)
    }
  }, [scale, x, y, zoom])

  const step = (cell: string | undefined) => {
    if (!cell) return
    setZoom(MIN_ZOOM)
    openLightbox(cell)
  }

  const keydown = ({ key }: KeyboardEvent) => {
    if (key === 'ArrowLeft') step(previous)
    if (key === 'ArrowRight') step(next)
  }

  const swipe = (_event: unknown, { offset }: PanInfo) => {
    if (zoomed) return
    if (offset.x > SWIPE_DISTANCE) step(previous)
    if (offset.x < -SWIPE_DISTANCE) step(next)
  }

  const wheel = ({ deltaY }: WheelEvent) => {
    setZoom((current) => clampZoom(current * (1 - deltaY * WHEEL_SPEED)))
  }

  // The wrapper fills the screen, so this is how far past each side it reaches once it is scaled.
  const overhang = (zoom - MIN_ZOOM) / 2
  const reach = { x: window.innerWidth * overhang, y: window.innerHeight * overhang }

  return (
    <Dialog open onOpenChange={(open) => !open && closeLightbox()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPrimitive.Popup
          aria-label={t('cell', { position: index + 1 })}
          className="fixed inset-0 z-50 flex flex-col outline-none"
          onKeyDown={keydown}
        >
          <DialogTitle className="sr-only">{t('cell', { position: index + 1 })}</DialogTitle>
          <div className="flex items-center justify-between gap-2 p-4">
            <p className="rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground">
              {t('lightboxPosition', { position: index + 1, total: cells.length })}
            </p>
            <div className="flex gap-2">
              <Group aria-label={t('zoom')}>
                <IconButton
                  variant="outline"
                  label={t('zoomOut')}
                  disabled={!zoomed}
                  onClick={() => setZoom(clampZoom(zoom - ZOOM_STEP))}
                >
                  <ZoomOut />
                </IconButton>
                <IconButton
                  variant="outline"
                  label={t('zoomIn')}
                  disabled={zoom >= MAX_ZOOM}
                  onClick={() => setZoom(clampZoom(zoom + ZOOM_STEP))}
                >
                  <ZoomIn />
                </IconButton>
              </Group>
              <IconButton variant="outline" label={t('close')} onClick={closeLightbox}>
                <X />
              </IconButton>
            </div>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            onWheel={wheel}
          >
            <m.div
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
              onDragEnd={swipe}
              style={{ x, y, scale }}
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
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
