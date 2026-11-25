import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Tabs, TabsPrimitive } from '@/components/ui/tabs'
import { cellShape, instagram } from '@/features/planner/network-profile'
import { usePlanner } from '@/features/planner/planner'
import { PictureImage, Thumbnail } from '@/features/planner/thumbnail'
import { cn } from '@/lib/utils'

import { TagLayer } from './tag-layer'
import type { TagDraft } from './tags'
import { useTagEditor } from './use-tag-editor'
import { VideoTags } from './video-tags'

const ARROW =
  'absolute z-20 top-1/2 -translate-y-1/2 rounded-full border-border bg-background text-foreground shadow-md dark:bg-background'

const NO_TAGS: TagDraft[] = []
const ignore = () => undefined

export interface Slide {
  id: string
  video: boolean
}

interface Tagging {
  tags: TagDraft[]
  onChange: (tags: TagDraft[]) => void
}

interface SlideViewerProps {
  slides: Slide[]
  index: number
  onIndexChange: (index: number) => void
  tagging?: Tagging
  className?: string
}

interface ControlsProps {
  current: number
  count: number
  go: (to: number) => void
}

function Controls({ current, count, go }: ControlsProps) {
  const { t } = useTranslation('provider')
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {t('post.viewer.position', { position: current + 1, count })}
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
        disabled={current === count - 1}
        className={cn(ARROW, 'right-2')}
        onClick={() => go(current + 1)}
      >
        <ChevronRight />
      </IconButton>
      <Tabs value={String(current)} onValueChange={(value) => go(Number(value))}>
        <TabsPrimitive.List
          activateOnFocus
          aria-label={t('post.viewer.label')}
          className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5"
        >
          {Array.from({ length: count }, (_, position) => (
            <TabsPrimitive.Tab
              key={position}
              value={String(position)}
              aria-label={t('post.viewer.go', { position: position + 1, count })}
              className="pointer-events-auto size-2 cursor-pointer rounded-full bg-background/60 ring-1 ring-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring data-active:bg-primary"
            />
          ))}
        </TabsPrimitive.List>
      </Tabs>
    </>
  )
}

function useFrameStyle(slide: Slide, tagging: boolean) {
  const size = usePlanner(({ images }) => images[slide.id])
  if (!tagging || slide.video) return cellShape
  const { width, height } = instagram.cellRatio
  const ratio = size ? size.width / size.height : width / height
  return { aspectRatio: ratio, width: `min(100%, calc(25rem * ${ratio}))`, marginInline: 'auto' }
}

export function SlideViewer({
  slides,
  index,
  onIndexChange,
  tagging,
  className
}: SlideViewerProps) {
  const { t } = useTranslation('provider')
  const last = slides.length - 1
  const current = Math.min(index, last)
  const slide = slides[current]
  const many = slides.length > 1
  const tags = tagging?.tags ?? NO_TAGS
  const editor = useTagEditor(tags, current, tagging?.onChange ?? ignore)
  const style = useFrameStyle(slide, tagging !== undefined)
  const here = tags.filter(({ mediaIndex = 0 }) => mediaIndex === current)
  const go = (to: number) => {
    editor.discard()
    onIndexChange(Math.min(Math.max(to, 0), last))
  }

  return (
    <div className={className}>
      <div
        role={many ? 'group' : undefined}
        aria-roledescription={many ? t('post.viewer.carousel') : undefined}
        aria-label={many ? t('post.viewer.label') : undefined}
        className="relative overflow-hidden rounded-sm bg-muted"
        style={style}
      >
        {tagging && !slide.video ? (
          <PictureImage key={slide.id} id={slide.id} label={t('post.picture')} />
        ) : (
          <Thumbnail key={slide.id} id={slide.id} label={t('post.picture')} />
        )}
        {tagging && !slide.video && <TagLayer editor={editor} tags={here} all={tags} />}
        {many && <Controls current={current} count={slides.length} go={go} />}
      </div>
      {tagging && slide.video && <VideoTags editor={editor} all={tags} here={here} />}
    </div>
  )
}
