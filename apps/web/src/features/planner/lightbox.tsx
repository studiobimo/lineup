import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Layers,
  MapPin,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { animate, AnimatePresence, m, type PanInfo, useMotionValue } from 'motion/react'
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent
} from 'react'
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
import { cn } from '@/lib/utils'

import { cellOf, containerOf, imagesOf } from './board'
import { closeLightbox, openLightbox } from './lightbox-store'
import { rise, settle } from './motion'
import { cellShape } from './network-profile'
import { usePlanner } from './planner'
import { FullSizeImage, Thumbnail } from './thumbnail'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 1
const WHEEL_SPEED = 0.002
// How far a drag at normal size has to go to count as a swipe to the next image, in pixels.
const SWIPE_DISTANCE = 80

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground',
        className
      )}
    >
      {children}
    </p>
  )
}

interface AlbumStripProps {
  images: string[]
  current: string
  onPick: (image: string) => void
}

/** The whole album in view, which says more than a count that an image belongs to one. */
function AlbumStrip({ images, current, onPick }: AlbumStripProps) {
  const { t } = useTranslation('planner')
  return (
    <m.div
      {...rise}
      role="group"
      aria-label={t('lightboxAlbumImages')}
      className="absolute bottom-4 flex max-w-[calc(100%-2rem)] gap-1 overflow-x-auto rounded-lg bg-popover p-1 shadow-md"
    >
      {images.map((image, index) => (
        <button
          key={image}
          type="button"
          aria-label={t('lightboxAlbumImage', { position: index + 1 })}
          aria-current={image === current || undefined}
          className={cn(
            'relative w-10 shrink-0 cursor-pointer overflow-hidden rounded-sm opacity-60 transition-opacity duration-150 ease-out outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
            image === current && 'opacity-100'
          )}
          style={cellShape}
          onClick={() => onPick(image)}
        >
          <Thumbnail id={image} label="" />
          {image === current && (
            <m.span
              layoutId="album-strip-current"
              transition={settle}
              className="absolute inset-0 rounded-sm ring-2 ring-primary ring-inset"
            />
          )}
        </button>
      ))}
    </m.div>
  )
}

/** When and where the photo was taken, for an image that says. Most say nothing. */
function ImageDetails({ id }: { id: string }) {
  const { t, i18n } = useTranslation('planner')
  const takenAt = usePlanner(({ images }) => images[id]?.takenAt)
  const place = usePlanner(({ images }) => images[id]?.place)
  const missing = usePlanner(({ images }) => images[id]?.missing)
  if (!takenAt && !place && !missing) return null
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso))
  return (
    <Pill className="gap-3">
      {takenAt && (
        <span className="flex items-center gap-1.5">
          <Calendar aria-hidden className="size-3.5 text-muted-foreground" />
          {t('takenOn', { date: date(takenAt) })}
        </span>
      )}
      {place && (
        <span className="flex items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 text-muted-foreground" />
          {t('takenIn', { place })}
        </span>
      )}
      {missing && (
        <span className="flex items-center gap-1.5">
          <ImageOff aria-hidden className="size-3.5 text-muted-foreground" />
          {t('missingOriginal')}
        </span>
      )}
    </Pill>
  )
}

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

  const [zoom, setZoom] = useState(MIN_ZOOM)
  const zoomed = zoom > MIN_ZOOM
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(MIN_ZOOM)
  const popup = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)

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

  // Letting go of a drag is a click too, wherever it ends.
  const closeOutside = ({ target }: MouseEvent) => {
    if (!dragged.current && 'outside' in (target as HTMLElement).dataset) close()
  }

  const wheel = ({ deltaY }: WheelEvent) => {
    setZoom((current) => clampZoom(current * (1 - deltaY * WHEEL_SPEED)))
  }

  // The wrapper fills the screen, so this is how far past each side it reaches once it is scaled.
  // A button disabled under focus takes the keyboard with it, and these keys are handled up here.
  useEffect(() => {
    const focused = document.activeElement
    if (!focused || focused === document.body || focused.matches(':disabled')) {
      popup.current?.focus()
    }
  }, [zoom, id])

  const overhang = (zoom - MIN_ZOOM) / 2
  const reach = { x: window.innerWidth * overhang, y: window.innerHeight * overhang }

  return (
    <Dialog {...dialog}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPrimitive.Popup
          ref={popup}
          aria-label={t('cell', { position: index + 1 })}
          data-outside
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
            <AnimatePresence>
              {album && <AlbumStrip key={cell} images={album} current={id} onPick={step} />}
            </AnimatePresence>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
