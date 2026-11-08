import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { boardStore, usePlanner } from './planner'
import { coverOf } from './board'
import { useCanvasImage } from './use-canvas-image'

const readThumbnail = (id: string) => boardStore.getThumbnail(id)
const readFullSize = (id: string) => boardStore.getPublishCopy(id)

interface StoredImageProps {
  id: string
  label: string
  read: (id: string) => Promise<Blob | undefined>
  className?: string
  cover?: boolean
}

function StoredImage({ id, label, read, className, cover }: StoredImageProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useCanvasImage(canvas, id, read, { cover })
  return <canvas ref={canvas} role="img" aria-label={label} className={className} />
}

type ImageProps = Pick<StoredImageProps, 'id' | 'label'>

export function Thumbnail(props: ImageProps) {
  return <StoredImage {...props} read={readThumbnail} className="size-full object-cover" cover />
}

/** A cell's picture, for anything that draws a cell: an album's cover, or the image itself. */
export function CellThumbnail({ id, label }: ImageProps) {
  const cover = usePlanner(({ board }) => coverOf(board, id))
  return <Thumbnail id={cover} label={label} />
}

/**
 * A video plays from its own bytes, through a URL that lives only while it is shown. Unlike an
 * <img>, a <video> lets go of what it loaded once its source is taken away. Keyed by its id where
 * it is used, so that another video starts from nothing.
 */
export function StoredVideo({ id, label, className }: ImageProps & { className?: string }) {
  const { t } = useTranslation('planner')
  const player = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'gone'>('loading')
  useEffect(() => {
    const element = player.current
    let url: string | undefined
    let live = true
    void readFullSize(id).then(
      (copy) => {
        if (!live) return
        if (!copy || !element) return setState('gone')
        url = URL.createObjectURL(copy)
        element.src = url
        setState('ready')
      },
      () => live && setState('gone')
    )
    return () => {
      live = false
      if (element) {
        element.removeAttribute('src')
        element.load()
      }
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])
  return (
    <>
      {state === 'gone' && (
        <p role="alert" className="text-sm text-muted-foreground">
          {t('videoUnavailable')}
        </p>
      )}
      <video
        ref={player}
        aria-label={label}
        controls
        muted
        autoPlay
        playsInline
        hidden={state === 'gone'}
        onError={() => setState('gone')}
        className={cn('object-contain', className)}
      />
    </>
  )
}

export function FullSizeImage({ className, ...props }: ImageProps & { className?: string }) {
  return <StoredImage {...props} read={readFullSize} className={cn('object-contain', className)} />
}
