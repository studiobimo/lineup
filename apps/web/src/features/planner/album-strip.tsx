import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { rise, settle } from './motion'
import { cellShape } from './network-profile'
import { Thumbnail } from './thumbnail'

interface AlbumStripProps {
  images: string[]
  current: string
  onPick: (image: string) => void
}

export function AlbumStrip({ images, current, onPick }: AlbumStripProps) {
  const { t } = useTranslation('planner')
  return (
    <m.div
      {...rise}
      role="group"
      aria-label={t('lightboxAlbumImages')}
      layoutScroll
      className="absolute bottom-4 flex max-w-[calc(100%-2rem)] gap-1 overflow-x-auto rounded-lg bg-popover p-1 shadow-md"
    >
      {images.map((image, index) => (
        <button
          key={image}
          type="button"
          aria-label={t('lightboxAlbumImage', { position: index + 1 })}
          aria-current={image === current || undefined}
          className="group/thumbnail relative w-10 shrink-0 cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={cellShape}
          onClick={() => onPick(image)}
        >
          <span
            className={cn(
              'block size-full overflow-hidden rounded-sm opacity-60 transition-opacity duration-150 ease-out group-hover/thumbnail:opacity-100',
              image === current && 'opacity-100'
            )}
          >
            <Thumbnail id={image} label="" />
          </span>
          {image === current && (
            <m.span
              layoutId="album-strip-current"
              transition={settle}
              className="pointer-events-none absolute inset-0 z-10 rounded-sm photo-outline"
            />
          )}
        </button>
      ))}
    </m.div>
  )
}
