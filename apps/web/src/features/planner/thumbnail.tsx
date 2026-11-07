import { useRef } from 'react'

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

export function FullSizeImage({ className, ...props }: ImageProps & { className?: string }) {
  return <StoredImage {...props} read={readFullSize} className={cn('object-contain', className)} />
}
