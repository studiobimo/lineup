import { useRef } from 'react'

import { useThumbnail } from './use-thumbnail'

export function Thumbnail({ id, label }: { id: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useThumbnail(canvas, id)
  return <canvas ref={canvas} role="img" aria-label={label} className="size-full object-cover" />
}
