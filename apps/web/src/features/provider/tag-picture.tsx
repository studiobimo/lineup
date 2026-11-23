/**
 * The way a tag is placed and moved here is adapted from the Focal Point Picker of KokonutUI,
 * https://kokonutui.com (https://github.com/kokonut-labs/kokonutui), MIT licence,
 * copyright @dorianbaffier. From it: the pointer capture drag, the clamp to the picture and
 * the arrow key nudge. The crop previews, next/image and its colours and strings are dropped.
 */
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PictureImage } from '@/features/planner/thumbnail'
import { cn } from '@/lib/utils'
import { nudged, pointIn, type TagDraft } from './tags'

const percent = (value = 0) => `${Math.round(value * 100)}%`

interface MarkerProps {
  tag: TagDraft
  position: number
  selected: boolean
  frame: React.RefObject<HTMLDivElement | null>
  onSelect: () => void
  onMove: (point: { x: number; y: number }) => void
  onRemove: () => void
}

function Marker({ tag, position, selected, frame, onSelect, onMove, onRemove }: MarkerProps) {
  const { t } = useTranslation('provider')
  const [dragging, setDragging] = useState(false)
  const name = tag.username ? `@${tag.username}` : t('post.tags.unnamed', { position })

  const at = (event: PointerEvent) => {
    const rect = frame.current?.getBoundingClientRect()
    return rect && pointIn(rect, event.clientX, event.clientY)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      return onRemove()
    }
    const point = nudged(tag, event.key, event.shiftKey)
    if (!point) return
    event.preventDefault()
    onMove(point)
  }

  return (
    <button
      type="button"
      aria-label={t('post.tags.marker', { name, x: percent(tag.x), y: percent(tag.y) })}
      aria-pressed={selected}
      className={cn(
        'absolute z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full outline-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={{ left: percent(tag.x), top: percent(tag.y) }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      onFocus={onSelect}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return
        event.stopPropagation()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setDragging(true)
        onSelect()
      }}
      onPointerMove={(event) => {
        const point = dragging && at(event)
        if (point) onMove(point)
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <span
        className={cn(
          'size-3 rounded-full border-2 border-background bg-primary shadow-sm',
          selected && 'ring-2 ring-ring'
        )}
      />
      <span className="pointer-events-none absolute top-full max-w-32 -translate-y-1 truncate rounded-sm bg-background/90 px-1.5 py-0.5 text-xs text-foreground shadow-sm">
        {name}
      </span>
    </button>
  )
}

interface TagPictureProps {
  image: string
  ratio: number
  tags: TagDraft[]
  pending: { x: number; y: number } | undefined
  selected: string | undefined
  full: boolean
  onAdd: (point: { x: number; y: number }) => void
  onSelect: (key: string) => void
  onMove: (key: string, point: { x: number; y: number }) => void
  onRemove: (key: string) => void
}

export function TagPicture({
  image,
  ratio,
  tags,
  pending,
  selected,
  full,
  onAdd,
  onSelect,
  onMove,
  onRemove
}: TagPictureProps) {
  const { t } = useTranslation('provider')
  const frame = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={frame}
      className="relative mx-auto touch-manipulation overflow-hidden rounded-sm bg-muted"
      style={{ aspectRatio: ratio, width: `min(100%, calc(25rem * ${ratio}))` }}
    >
      <div className="pointer-events-none absolute inset-0">
        <PictureImage id={image} label={t('post.tags.picture')} />
      </div>
      <button
        type="button"
        data-testid="tag-picture"
        aria-label={t('post.tags.place')}
        disabled={full}
        className="absolute inset-0 cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
        onClick={(event) => {
          const rect = frame.current?.getBoundingClientRect()
          // A key press has no pointer position, so it places the tag in the middle. ~keep
          if (rect)
            onAdd(
              event.detail === 0 ? { x: 0.5, y: 0.5 } : pointIn(rect, event.clientX, event.clientY)
            )
        }}
      />
      {pending && (
        // Dashed and hollow, so it reads as not yet a tag; the username field below is its control. ~keep
        <span
          aria-hidden
          data-testid="pending-tag"
          className="pointer-events-none absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-primary bg-background/60 shadow-sm"
          style={{ left: percent(pending.x), top: percent(pending.y) }}
        />
      )}
      {tags.map((tag, index) => (
        <Marker
          key={tag.key}
          tag={tag}
          position={index + 1}
          selected={tag.key === selected}
          frame={frame}
          onSelect={() => onSelect(tag.key)}
          onMove={(point) => onMove(tag.key, point)}
          onRemove={() => onRemove(tag.key)}
        />
      ))}
    </div>
  )
}
