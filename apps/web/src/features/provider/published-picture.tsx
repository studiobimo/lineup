import type { PublishedPost } from 'lineup-contract'
import { ImageOff } from 'lucide-react'
import { useRef, useState } from 'react'

import { useNearViewport } from '@/features/planner/use-near-viewport'

interface PublishedPictureProps {
  post: PublishedPost
  label: string
}

/** A signed link at Instagram can lapse, and it is no reason to leave a broken image in the feed. */
export function PublishedPicture({ post: { thumbnailUrl }, label }: PublishedPictureProps) {
  const holder = useRef<HTMLDivElement>(null)
  const near = useNearViewport(holder)
  const [broken, setBroken] = useState(false)
  if (!thumbnailUrl || broken) {
    return (
      <div
        role="img"
        aria-label={label}
        className="flex size-full items-center justify-center text-muted-foreground"
      >
        <ImageOff aria-hidden className="size-5" />
      </div>
    )
  }
  return (
    <div ref={holder} className="size-full">
      {near && (
        <img
          src={thumbnailUrl}
          alt={label}
          referrerPolicy="no-referrer"
          draggable={false}
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  )
}
