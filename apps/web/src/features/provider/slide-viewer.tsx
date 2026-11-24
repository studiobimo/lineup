import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Tabs, TabsPrimitive } from '@/components/ui/tabs'
import { cellShape } from '@/features/planner/network-profile'
import { Thumbnail } from '@/features/planner/thumbnail'
import { cn } from '@/lib/utils'

const ARROW =
  'absolute top-1/2 -translate-y-1/2 rounded-full border-border bg-background text-foreground shadow-md dark:bg-background'

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

export function SlideViewer({ slides, index, onIndexChange, className }: SlideViewerProps) {
  const { t } = useTranslation('provider')
  const last = slides.length - 1
  const current = Math.min(index, last)
  const slide = slides[current]
  const many = slides.length > 1
  const go = (to: number) => onIndexChange(Math.min(Math.max(to, 0), last))

  return (
    <div
      role={many ? 'group' : undefined}
      aria-roledescription={many ? t('post.viewer.carousel') : undefined}
      aria-label={many ? t('post.viewer.label') : undefined}
      className={cn('relative overflow-hidden rounded-sm bg-muted', className)}
      style={cellShape}
    >
      <Thumbnail key={slide.id} id={slide.id} label={t('post.picture')} />
      {many && (
        <>
          <p aria-live="polite" className="sr-only">
            {t('post.viewer.position', { position: current + 1, count: slides.length })}
          </p>
          <IconButton
            type="button"
            label={t('post.viewer.previous')}
            disabled={current === 0}
            className={cn(ARROW, 'left-2')}
            onClick={() => go(current - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            type="button"
            label={t('post.viewer.next')}
            disabled={current === last}
            className={cn(ARROW, 'right-2')}
            onClick={() => go(current + 1)}
          >
            <ChevronRight />
          </IconButton>
          <Tabs value={String(current)} onValueChange={(value) => go(Number(value))}>
            <TabsPrimitive.List
              activateOnFocus
              aria-label={t('post.viewer.label')}
              className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5"
            >
              {slides.map(({ id }, position) => (
                <TabsPrimitive.Tab
                  key={id}
                  value={String(position)}
                  aria-label={t('post.viewer.go', { position: position + 1, count: slides.length })}
                  className="size-2 cursor-pointer rounded-full bg-background/60 ring-1 ring-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring data-active:bg-primary"
                />
              ))}
            </TabsPrimitive.List>
          </Tabs>
        </>
      )}
    </div>
  )
}
