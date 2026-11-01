import { useRef } from 'react'

import { cn } from '@/lib/utils'

import { boardStore } from './planner'
import { useCanvasImage } from './use-canvas-image'

const readThumbnail = (id: string) => boardStore.getThumbnail(id)
const readFullSize = (id: string) => boardStore.getPublishCopy(id)

interface StoredImageProps {
  id: string
  label: string
  read: (id: string) => Promise<Blob | undefined>
  className?: string
}

function StoredImage({ id, label, read, className }: StoredImageProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useCanvasImage(canvas, id, read)
  return <canvas ref={canvas} role="img" aria-label={label} className={className} />
}

type ImageProps = Pick<StoredImageProps, 'id' | 'label'>

export function Thumbnail(props: ImageProps) {
  return <StoredImage {...props} read={readThumbnail} className="size-full object-cover" />
}

export function FullSizeImage({ className, ...props }: ImageProps & { className?: string }) {
  return <StoredImage {...props} read={readFullSize} className={cn('object-contain', className)} />
}
