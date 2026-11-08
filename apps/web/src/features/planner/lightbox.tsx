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
import { FullSizeImage, StoredVideo } from './thumbnail'
import { useZoom } from './use-zoom'

const SWIPE_DISTANCE = 80

const PAN_BUTTONS = [
  { key: 'ArrowLeft', label: 'panLeft', icon: ArrowLeft },
  { key: 'ArrowUp', label: 'panUp', icon: ArrowUp },
  { key: 'ArrowDown', label: 'panDown', icon: ArrowDown },
  { key: 'ArrowRight', label: 'panRight', icon: ArrowRight }
] as const

function LightboxHeader({
  id,
  index,
  total,
  album,
  video,
  zoomed,
  canZoomIn,
  zoomIn,
  zoomOut,
  close
}: {
  id: string
  index: number
  total: number
  album?: string[]
  video: boolean
  zoomed: boolean
  canZoomIn: boolean
  zoomIn: () => void
  zoomOut: () => void
  close: () => void
}) {
  const { t } = useTranslation('planner')
  return (
    <div data-outside className="flex items-center justify-between gap-2 p-4">
      <div data-outside className="flex flex-1 flex-wrap items-center gap-2">
        <Pill>{t('lightboxPosition', { position: index + 1, total: total })}</Pill>
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
            disabled={video || !zoomed}
            onClick={zoomOut}
          >
            <ZoomOut />
          </IconButton>
          <IconButton
            variant="outline"
            label={t('zoomIn')}
            disabled={video || !canZoomIn}
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
  )
}

function LightboxNav({
  previous,
  next,
  step,
  zoomed,
  pan
}: {
  previous?: string
  next?: string
  step: (cell: string | undefined) => void
  zoomed: boolean
  pan: (key: string) => void
}) {
  const { t } = useTranslation('planner')
  return (
    <>
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
    </>
  )
}

function LightboxStage({
  id,
  index,
  video,
  zoomed,
  zoom,
  reach,
  motion,
  onDragStart,
  onDragEnd
}: {
  id: string
  index: number
  video: boolean
  zoomed: boolean
  zoom: number
  reach: { x: number; y: number }
  motion: ReturnType<typeof useZoom>['motion']
  onDragStart: () => void
  onDragEnd: (event: unknown, info: PanInfo) => void
}) {
  const { t } = useTranslation('planner')
  return (
    <m.div
      data-outside
      className="flex size-full items-center justify-center p-4"
      drag={!video}
      dragMomentum={false}
      dragElastic={zoomed ? 0.1 : 0.4}
      dragSnapToOrigin={!zoomed}
      dragConstraints={{
        left: -reach.x,
        right: reach.x,
        top: -reach.y,
        bottom: reach.y
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={motion}
      data-zoom={zoom}
    >
      {video ? (
        <StoredVideo
          key={id}
          id={id}
          label={t('videoCell', { position: index + 1 })}
          className="max-h-full max-w-full"
        />
      ) : (
        <FullSizeImage
          id={id}
          label={t('cell', { position: index + 1 })}
          className="max-h-full max-w-full"
        />
      )}
    </m.div>
  )
}

function useLightboxCells(id: string) {
  const board = usePlanner((state) => state.board)
  const { cells, cell, images } = useMemo(() => {
    const cell = cellOf(board, id)
    const cells = board[containerOf(board, cell)]
    return { cells, cell, images: cells.flatMap((each) => imagesOf(board, each)) }
  }, [board, id])
  const index = cells.indexOf(cell)
  const stepIndex = images.indexOf(id)
  const previous = images[stepIndex - 1]
  const next = images[stepIndex + 1]
  const album = board.albums?.[cell]
  const video = usePlanner(({ images }) => images[id]?.video !== undefined)
  return { cells, cell, index, previous, next, album, video }
}

function useLightboxSteps({
  previous,
  next,
  zoomed,
  pan,
  reset
}: {
  previous?: string
  next?: string
  zoomed: boolean
  pan: (key: string) => void
  reset: () => void
}) {
  const step = (cell: string | undefined) => {
    if (!cell) return
    reset()
    openLightbox(cell)
  }

  const keydown = ({ key, target }: KeyboardEvent) => {
    if (target instanceof HTMLVideoElement) return
    if (zoomed) return pan(key)
    if (key === 'ArrowLeft') step(previous)
    if (key === 'ArrowRight') step(next)
  }

  const swipe = (_event: unknown, { offset }: PanInfo) => {
    if (zoomed) return
    if (offset.x > SWIPE_DISTANCE) step(previous)
    if (offset.x < -SWIPE_DISTANCE) step(next)
  }
  return { step, keydown, swipe }
}

export function Lightbox({ id }: { id: string }) {
  const { t } = useTranslation('planner')
  const { dialog, close } = useDialogPresence(closeLightbox)
  const { cells, cell, index, previous, next, album, video } = useLightboxCells(id)

  const { zoom, zoomed, canZoomIn, motion, reach, zoomIn, zoomOut, reset, wheel, pan } = useZoom()
  const popup = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)

  const { step, keydown, swipe } = useLightboxSteps({ previous, next, zoomed, pan, reset })

  const closeOutside = ({ target }: MouseEvent) => {
    if (!dragged.current && 'outside' in (target as HTMLElement).dataset) close()
  }

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
          <LightboxHeader
            id={id}
            index={index}
            total={cells.length}
            album={album}
            video={video}
            zoomed={zoomed}
            canZoomIn={canZoomIn}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            close={close}
          />
          <div
            data-outside
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            onWheel={video ? undefined : wheel}
          >
            <LightboxStage
              id={id}
              index={index}
              video={video}
              zoomed={zoomed}
              zoom={zoom}
              reach={reach}
              motion={motion}
              onDragStart={() => (dragged.current = true)}
              onDragEnd={swipe}
            />
            <LightboxNav previous={previous} next={next} step={step} zoomed={zoomed} pan={pan} />
            <AnimatePresence>
              {album && <AlbumStrip key={cell} images={album} current={id} onPick={step} />}
            </AnimatePresence>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
