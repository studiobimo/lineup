import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { cellShape } from '@/features/planner/network-profile'
import { Thumbnail } from '@/features/planner/thumbnail'
import { cn } from '@/lib/utils'

export interface Slide {
  id: string
  video: boolean
}

interface SlideViewerProps {
  slides: Slide[]
  index: number
  onIndexChange: (index: number) => void
  className?: string
}

const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

export function SlideViewer({ slides, index, onIndexChange, className }: SlideViewerProps) {
  const { t } = useTranslation('provider')
  const last = slides.length - 1
  const current = Math.min(index, last)
  const slide = slides[current]
  const many = slides.length > 1
  const go = (to: number) => onIndexChange(Math.min(Math.max(to, 0), last))

  const onKeyDown = (event: KeyboardEvent) => {
    const step = STEPS[event.key]
    if (!many || !step) return
    event.preventDefault()
    go(current + step)
  }

  return (
    <div
      role={many ? 'group' : undefined}
      aria-roledescription={many ? t('post.viewer.carousel') : undefined}
      aria-label={many ? t('post.viewer.label') : undefined}
      className={cn('relative overflow-hidden rounded-sm bg-muted', className)}
      style={cellShape}
      onKeyDown={onKeyDown}
    >
      <Thumbnail key={slide.id} id={slide.id} label={t('post.picture')} />
      {many && (
        <>
          <p aria-live="polite" className="sr-only">
            {t('post.viewer.position', { position: current + 1, count: slides.length })}
          </p>
          <IconButton
            type="button"
            variant="secondary"
            label={t('post.viewer.previous')}
            disabled={current === 0}
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full"
            onClick={() => go(current - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            type="button"
            variant="secondary"
            label={t('post.viewer.next')}
            disabled={current === last}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
            onClick={() => go(current + 1)}
          >
            <ChevronRight />
          </IconButton>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {slides.map(({ id }, position) => (
              <button
                key={id}
                type="button"
                aria-label={t('post.viewer.go', { position: position + 1, count: slides.length })}
                aria-current={position === current}
                className={cn(
                  'size-2 rounded-full bg-background/60 ring-1 ring-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  position === current && 'bg-primary'
                )}
                onClick={() => go(position)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
